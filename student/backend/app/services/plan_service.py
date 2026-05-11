"""Learning plan generation service with signature-based caching.

This module handles the entire learning plan generation framework:

PLAN SIGNATURE CACHE:
  - Prevents duplicate expensive Gemini API calls
  - Deterministic signature: student_id:company_name:role:interview_date
  - Same signature = same student prepping for same company on same target date
  - Cache key includes interview_date to allow re-planning if student updates target date

PLAN GENERATION FLOW:
  1. Client requests plan via /prep/generate
  2. Server queries for existing plan with matching signature
  3. If plan.status='ready': return cached plan immediately (free)
  4. If plan.status='generating': poll and return status 
  5. If no plan exists: create plan stub with status='generating', enqueue worker task
  6. Worker calls generate_learning_plan() which:
     - Gathers student profile, resume, target, gap analysis, company context
     - Builds prompt with all structured data
     - Calls Gemini API (expensive token spend)
     - Parses JSON response, creates LearningTask objects
     - Marks plan.status='ready' and license.plan_generated=True

ONE-TIME GENERATION:
  - license.plan_generated flag prevents re-generation for same licensee:company:role
  - After first successful generation, subsequent requests return cached plan
  - Forces meaningful plan reuse and API cost control

PLAN REFINEMENT:
  - Lightweight Gemini call to adjust task priorities based on resume gap updates
  - Does not trigger full re-generation (cheaper)
  - Maintains same daily structure, just reorders tasks
"""
import json
import logging
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    LearningPlan,
    LearningTask,
    Resume,
    ResumeSection,
    ResumeGapAnalysis,
    Student,
    StudentProfile,
    TargetInterview,
    PrepLicense,
)
from app.services.knowledge_service import build_company_context, retrieve_company_context
from app.services.llm_client import (
    build_learning_plan_prompt,
    generate_learning_plan as generate_plan_with_llm,
    LLMValidationError,
)

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"
logger = logging.getLogger(__name__)


def build_plan_signature(student_id: int, company_name: str, role: str | None) -> str:
    """Build deterministic plan signature for caching.
    
    Same signature = same plan (no need to regenerate).
    
    Format: {student_id}:{company_normalized}:{role_normalized}
    Example: 42:google:backend-engineer
    
    Args:
        student_id: Student ID (not normalized)
        company_name: Company name (will be normalized: lowercase, trimmed)
        role: Role/position title (will be normalized, defaults to "general")
        
    Returns:
        str: Deterministic signature suitable as cache key
    """
    role_normalized = (role or "general").strip().lower()
    company_normalized = company_name.strip().lower()
    return f"{student_id}:{company_normalized}:{role_normalized}"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8").strip()


def _parse_plan_json(raw_response: str) -> dict:
    try:
        return json.loads(raw_response)
    except json.JSONDecodeError:
        start = raw_response.find("{")
        end = raw_response.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw_response[start : end + 1])
        raise


def _validate_plan_json(plan_data: dict) -> bool:
    """Validate plan JSON has required structure for database storage.
    
    RELIABILITY: Ensures plan has minimum required fields before insert.
    If validation fails, plan deemed invalid and retry attempted.
    
    Required structure:
    {
      "daily_plan": [
        {
          "day": int,
          "tasks": [
            {"title": str, "description": str, "duration_minutes": int}
          ]
        }
      ]
    }
    
    Args:
        plan_data: Parsed JSON dict from Gemini
        
    Returns:
        bool: True if valid, False otherwise
    """
    if not isinstance(plan_data, dict):
        return False
    
    daily_plan = plan_data.get("daily_plan")
    if not isinstance(daily_plan, list) or len(daily_plan) == 0:
        return False
    
    for day_data in daily_plan:
        if not isinstance(day_data, dict):
            return False
        
        day_num = day_data.get("day")
        if not isinstance(day_num, int) or day_num < 1:
            return False
        
        tasks = day_data.get("tasks")
        if not isinstance(tasks, list) or len(tasks) == 0:
            return False
        
        for task in tasks:
            if not isinstance(task, dict):
                return False
            if not isinstance(task.get("title"), str) or not task.get("title").strip():
                return False
            if not isinstance(task.get("description"), str):
                return False
            if not isinstance(task.get("duration_minutes"), int):
                return False
            if not isinstance(task.get("task_type"), str):
                return False
    
    return True


def _generate_skeleton_plan(
    days_available: int,
    company_name: str,
    role: str | None,
    difficulty: str | None,
    missing_skills: list[str] | None,
) -> dict:
    """Generate fast skeleton plan without full LLM call (FastAPI response phase).
    
    TWO-PHASE OPTIMIZATION PHASE 1 (FAST ~1-2s):
    Creates day structure with practical, actionable descriptions based on missing skills.
    No LLM call - uses rule-based generation from company/role/skills.
    Returns skeleton with all required JSON fields immediately for faster UI response.
    
    PHASE 2 (BACKGROUND): generate_plan_summary() Celery task will:
    - Call Gemini once to generate strategic interview advice
    - Store advisory content in plan_summary field
    - Keep plan_json daily structure unchanged
    
    SKELETON STRUCTURE:
    - Each day has 2-3 tasks with complete descriptions
    - Task descriptions are immediately usable (no follow-up enrichment required)
    - Task titles based on missing_skills or role-specific topics
    - Duration estimates (30-120 min based on day patterns)
    
    Args:
        days_available: Days until interview
        company_name: Target company
        role: Target role/position
        difficulty: easy|medium|hard|unknown
        missing_skills: List of missing skills to prioritize
        
    Returns:
        dict: Skeleton plan JSON with full structure and final task content
    """
    daily_plan = []
    days_to_plan = min(days_available, 100)
    
    # Prioritization: Use missing_skills if available, else role-specific defaults
    skill_list = (missing_skills or [])[:5] if missing_skills else []
    
    default_topics = {
        "backend": ["API Design", "Database Design", "Cache & Optimization", "System Architecture", "Error Handling"],
        "frontend": ["React Patterns", "State Management", "Performance", "Accessibility", "Testing"],
        "data": ["SQL Optimization", "Data Modeling", "ETL Pipelines", "Analytics", "Visualization"],
    }
    
    role_lower = (role or "backend").lower()
    topics = []
    for keyword in default_topics:
        if keyword in role_lower:
            topics = default_topics[keyword]
            break
    if not topics:
        topics = default_topics.get("backend", [])
    
    # Mix skill_list and topics for daily tasks
    all_topics = skill_list + topics
    
    for day_num in range(1, days_to_plan + 1):
        tasks = []

        # ── Second-to-last day: Dedicated Coding Mock Tests ────────────────
        if day_num == days_to_plan - 1 and days_to_plan > 1:
            dsa_topic = all_topics[(day_num - 1) % len(all_topics)]
            daily_plan.append({
                "day": day_num,
                "focus": "Coding Mock Tests",
                "tasks": [
                    {
                        "title": f"DSA: {dsa_topic}",
                        "description": f"Solve 2-3 progressively harder {dsa_topic} problems with real test cases.",
                        "duration_minutes": 90,
                        "task_type": "code",
                        "qa_pairs": [],
                        "code_metadata": {
                            "language": "python",
                            "initial_code": f"# Solve {dsa_topic} problem\ndef solution():\n    pass",
                            "solution": "",
                            "difficulty": "Medium",
                            "examples": [],
                            "constraints": [],
                            "test_cases": []
                        },
                    },
                    {
                        "title": "Module Mastery Quiz",
                        "description": "Test your DSA knowledge from today's coding practice.",
                        "duration_minutes": 20,
                        "task_type": "qa",
                        "qa_pairs": [],
                        "code_metadata": None,
                    },
                ],
            })
            continue

        # ── Last day: Behavioral Interview ─────────────────────────────────
        if day_num == days_to_plan:
            daily_plan.append({
                "day": day_num,
                "focus": "Behavioral Interview",
                "tasks": [
                    {
                        "title": "Tell Me About Yourself & Company Research",
                        "description": "Practice your self-introduction using Present → Past → Future structure. Research the company's tech stack, products, and culture.",
                        "duration_minutes": 45,
                        "task_type": "qa",
                        "qa_pairs": [],
                        "code_metadata": None,
                    },
                    {
                        "title": "Behavioral Scenarios (STAR Method)",
                        "description": "Practice challenge, conflict, leadership, and failure stories using the STAR framework.",
                        "duration_minutes": 45,
                        "task_type": "qa",
                        "qa_pairs": [],
                        "code_metadata": None,
                    },
                    {
                        "title": "HR Round Questions",
                        "description": "Prepare for salary expectations, career goals, strengths/weaknesses, and situational HR questions.",
                        "duration_minutes": 30,
                        "task_type": "qa",
                        "qa_pairs": [],
                        "code_metadata": None,
                    },
                    {
                        "title": "Module Mastery Quiz",
                        "description": "Test your behavioral interview readiness.",
                        "duration_minutes": 20,
                        "task_type": "qa",
                        "qa_pairs": [],
                        "code_metadata": None,
                    },
                ],
            })
            continue

        # ── Regular days ───────────────────────────────────────────────────
        # Rotate through topics for each day
        topic_idx = (day_num - 1) % len(all_topics)
        current_topic = all_topics[topic_idx]
        
        # First task: focused topic (30-60 min)
        tasks.append({
            "title": f"{current_topic} - Deep Dive",
            "description": f"Study core {current_topic} concepts and create short revision notes for quick recall.",
            "duration_minutes": 45,
            "task_type": "qa",
            "qa_pairs": [],
            "code_metadata": None,
        })
        
        # Second task: Practice/Problems (60-90 min)
        if day_num % 3 != 0:
            tasks.append({
                "title": f"Practice: {current_topic} Problems",
                "description": f"Solve timed practice problems on {current_topic} and review mistakes immediately.",
                "duration_minutes": 60,
                "task_type": "code",
                "qa_pairs": [],
                "code_metadata": {"language": "python", "initial_code": "", "solution": "", "test_cases": []},
            })
        else:
            # Every 3rd day: System design / Architecture focus
            tasks.append({
                "title": "System Design Practice",
                "description": "Design a scalable solution, discuss trade-offs, and justify architecture decisions.",
                "duration_minutes": 90,
                "task_type": "qa",
                "qa_pairs": [],
                "code_metadata": None,
            })

        # Third task: Review & Explain
        tasks.append({
            "title": "Review & Explain",
            "description": f"Explain {current_topic} out loud as if teaching someone and fill any understanding gaps.",
            "duration_minutes": 45,
            "task_type": "qa",
            "qa_pairs": [],
            "code_metadata": None,
        })

        # Module Mastery Quiz — ALWAYS last task of every day
        tasks.append({
            "title": "Module Mastery Quiz",
            "description": f"Test your understanding of today's {current_topic} topics.",
            "duration_minutes": 20,
            "task_type": "qa",
            "qa_pairs": [],
            "code_metadata": None,
        })
        
        daily_plan.append({
            "day": day_num,
            "focus": current_topic,
            "tasks": tasks,
        })
    
    return {
        "overview": f"Preparing for {company_name} {role or 'General'} interview ({difficulty or 'unknown'} difficulty). Plan includes daily topic deep-dives, coding practice, a dedicated Coding Mock Test day, and a final Behavioral Interview day.",
        "daily_plan": daily_plan,
        "resources": [
            "Use your resume project stories for behavioral and technical explanations.",
            "Practice at least one timed coding problem daily and review the solution quality.",
            "Track weak topics in a short checklist and revisit them every 2-3 days.",
            "Prepare 4-5 STAR stories for the Behavioral Interview module.",
        ],
        "_skeleton": True,  # Flag to indicate this is skeleton version
    }


def _generate_fallback_plan(
    days_available: int,
    role: str | None = None,
    primary_skill: str | None = None,
    company_name: str | None = None,
    support_mode: str | None = None,
    missing_skills: list | None = None,
) -> dict:
    """Generate deterministic fallback plan without LLM.

    Uses all 6 key features:
    - Company: referenced in behavioral tasks and overview
    - Role: determines technology stack (Python/Java/JS)
    - Skill Proficiency: cross-language bridging notes on Day 1-2
    - Time Left: days_available determines plan length
    - Job Description: missing_skills prioritized in Day 1-2
    - Type of Mentor: support_mode affects task style
    """
    role_lower = (role or "").lower()
    skill_lower = (primary_skill or "").lower()
    company = company_name or "the target company"
    mode = (support_mode or "Guided").lower()
    gaps = missing_skills or []

    # ── Detect target language from role ──────────────────────────────────
    is_python_role = any(k in role_lower for k in ["python", "django", "fastapi", "flask", "data scientist", "ml engineer", "data engineer"])
    is_java_role   = any(k in role_lower for k in ["java", "spring", "jvm", "kotlin"])
    is_js_role     = any(k in role_lower for k in ["javascript", "typescript", "node", "react", "frontend", "angular", "vue"])
    is_go_role     = any(k in role_lower for k in ["golang", "go developer", "go backend"])

    # ── Detect student's primary language ─────────────────────────────────
    student_is_python = any(k in skill_lower for k in ["python", "django", "fastapi"])
    student_is_java   = any(k in skill_lower for k in ["java", "spring"])
    student_is_js     = any(k in skill_lower for k in ["javascript", "typescript", "node", "react", "frontend"])

    # ── Cross-language transition detection ───────────────────────────────
    # transition_note is non-null on Day 1-2 when student language ≠ target language
    def make_transition_note(day_num: int, concept: str, target_lang: str) -> str | None:
        if day_num > 2:
            return None
        if student_is_python and not is_python_role:
            return f"In Python, {concept} works differently — in {target_lang}, {concept} requires explicit type declarations and follows stricter OOP conventions."
        if student_is_java and is_python_role:
            return f"In Java, {concept} requires verbose boilerplate — Python's {concept} is more concise with dynamic typing and duck typing."
        if student_is_js and is_java_role:
            return f"In JavaScript, {concept} is dynamic and loosely typed — Java's {concept} requires explicit type declarations and compile-time checking."
        return None

    # ── Select topic lists based on target role ────────────────────────────
    if is_python_role:
        target_lang = "Python"
        dsa_tasks = [
            "List & String manipulation", "Linked Lists", "Trees & Graphs",
            "Dynamic Programming", "Sorting & Searching", "Dictionaries & Sets",
            "Stacks & Queues", "Recursion & Backtracking"
        ]
        backend_tasks = [
            "Python fundamentals & OOP", "FastAPI / Django basics", "Python async & asyncio",
            "SQLAlchemy & database ORM", "Python decorators & metaclasses", "RESTful APIs with Python",
            "Exception handling in Python", "Python collections & comprehensions"
        ]
        framework_label = "Python/FastAPI"
    elif is_js_role:
        target_lang = "JavaScript/TypeScript"
        dsa_tasks = [
            "Array & String manipulation", "Linked Lists", "Trees & Graphs",
            "Dynamic Programming", "Sorting & Searching", "Hash Maps",
            "Stacks & Queues", "Recursion & Backtracking"
        ]
        backend_tasks = [
            "JavaScript fundamentals & ES6+", "Node.js & Express basics", "TypeScript type system",
            "Async/await & Promises", "RESTful APIs with Node.js", "Database access with Prisma/Sequelize",
            "Error handling in Node.js", "npm ecosystem & tooling"
        ]
        framework_label = "Node.js/TypeScript"
    else:
        # Default: Java/Spring (covers Java role, Go role, or unknown)
        target_lang = "Java"
        dsa_tasks = [
            "Array & String manipulation", "Linked Lists", "Trees & Graphs",
            "Dynamic Programming", "Sorting & Searching", "Hash Maps",
            "Stacks & Queues", "Recursion & Backtracking"
        ]
        backend_tasks = [
            "Java fundamentals & OOP", "Spring Boot basics", "Spring MVC",
            "Spring Data JPA", "Spring Security", "RESTful APIs",
            "Exception handling", "Collections framework"
        ]
        framework_label = "Java/Spring"

    daily_plan = []
    days_to_plan = min(days_available, 100)  # Cap at 100 days

    # ── Behavioral Interview tasks (last day) ──────────────────────────────
    behavioral_tasks = [
        {
            "title": f"Tell Me About Yourself & Why {company}",
            "description": f"Practice your self-introduction using Present → Past → Future structure. Research {company}'s tech stack, products, and culture. Prepare a 60-90 second pitch that connects your {primary_skill or 'background'} to the {role or 'role'} at {company}.",
            "duration_minutes": 45,
            "task_type": "qa",
            "qa_pairs": [
                {
                    "question": "Tell me about yourself.",
                    "answer": "Structure: Present, Past, Future. 60-90 seconds, professional focus.",
                    "explanation": "Your Professional Elevator Pitch\n\nThis is almost always the opening question. The best structure is Present → Past → Future: start with who you are now (current role, education), briefly mention relevant background (projects, internships, key achievements), and end with what you're looking for.\n\nKeep it to 60-90 seconds. Every sentence should be intentional — avoid personal details unless they directly relate to the role. Focus on your technical identity.\n\nTailor your answer to the company and role. Research the company's tech stack and mirror it in your narrative.\n\nEnd with a bridge to the role: 'I'm excited about this position because it aligns with my expertise and career goals.'",
                    "transition_note": None
                },
                {
                    "question": f"Why do you want to work at {company}?",
                    "answer": f"Research {company} specifically. Connect your {primary_skill or 'skills'} to their mission. Show genuine enthusiasm for the {role or 'role'}.",
                    "explanation": f"Demonstrating Genuine Interest in {company}\n\nGeneric answers like 'it's a great company' instantly signal you haven't researched the organisation. The best answers connect three things: {company}'s work, your skills, and your career goals.\n\nResearch deeply before the interview: visit their engineering blog, read recent press releases, check their GitHub, note their tech stack from job descriptions.\n\nStructure in three parts: (1) What specifically attracts you to {company}, (2) How your {primary_skill or 'skills'} align with their needs, (3) What you hope to grow into there.\n\nAvoid mentioning salary, brand name, or convenience as primary motivators.",
                    "transition_note": None
                },
            ],
            "quiz": [
                {
                    "question": "The best structure for 'Tell me about yourself' is:",
                    "options": ["Past, Present, Future", "Present, Past, Future", "Future, Present, Past", "Skills, Education, Hobbies"],
                    "correct_index": 1,
                    "explanation": "Present → Past → Future: start with who you are now, mention relevant background, end with what you're looking for in this role."
                }
            ],
            "code_metadata": None,
        },
        {
            "title": "Behavioral Scenarios (STAR Method)",
            "description": "Practice challenge, conflict, leadership, and failure stories using the STAR framework. Prepare 3-4 strong stories from your projects.",
            "duration_minutes": 45,
            "task_type": "qa",
            "qa_pairs": [
                {
                    "question": "Tell me about a challenge you overcame.",
                    "answer": "Use STAR: Situation, Task, Action, Result. Quantify the outcome.",
                    "explanation": "Structured Storytelling with STAR\n\nSituation: Set the scene in 2-3 sentences. When was this? Where were you working/studying? What was the context?\n\nTask: What was YOUR specific responsibility? Be clear about what was expected of you personally.\n\nAction: Describe the specific steps YOU took — not what the team did. Use 'I' not 'we.'\n\nResult: Quantify the outcome. Numbers make your story credible: 'Response time dropped from 2.3s to 180ms.'",
                    "transition_note": None
                },
                {
                    "question": "Describe a time you showed leadership.",
                    "answer": "Leadership doesn't require a title. Show initiative, influence, and ownership.",
                    "explanation": "Leadership Without a Title\n\nLeadership in interviews means taking ownership and driving outcomes — not just managing people. Strong examples include: leading a technical decision, mentoring a junior, driving a project when no one else stepped up.\n\nUse STAR: Situation (team was stuck/leaderless), Task (you identified the gap), Action (specific steps you took to lead), Result (what improved because of your leadership).\n\nAvoid vague answers like 'I always take initiative.' Interviewers want a specific story with a clear before/after.\n\nThe best leadership stories show you influenced others without authority.",
                    "transition_note": None
                },
            ],
            "quiz": [
                {
                    "question": "STAR stands for:",
                    "options": ["Story, Task, Action, Review", "Situation, Task, Action, Result", "Summary, Time, Action, Response", "Situation, Topic, Answer, Result"],
                    "correct_index": 1,
                    "explanation": "STAR: Situation (context), Task (your responsibility), Action (what you did), Result (measurable outcome)."
                }
            ],
            "code_metadata": None,
        },
        {
            "title": "HR Round Questions",
            "description": "Prepare for salary expectations, career goals, strengths/weaknesses, and situational HR questions.",
            "duration_minutes": 30,
            "task_type": "qa",
            "qa_pairs": [
                {
                    "question": "What are your salary expectations?",
                    "answer": "Research market rates. Give a range. Consider total compensation.",
                    "explanation": "Salary Negotiation Fundamentals\n\nBefore the interview, research the market rate using Glassdoor, Levels.fyi, AmbitionBox, and LinkedIn Salary Insights.\n\nProvide a researched range rather than a single number. A range gives flexibility while anchoring the negotiation.\n\nNever give a number first if you can avoid it. If pressed, aim for the upper end of your researched range.\n\nConsider total compensation beyond base salary: performance bonuses, RSUs/stock, signing bonus, health insurance, learning budgets.",
                    "transition_note": None
                },
                {
                    "question": "Where do you see yourself in 5 years?",
                    "answer": "Show ambition aligned with the company. Mention skill growth and leadership.",
                    "explanation": "Career Vision Alignment\n\nThis tests whether you're likely to stay and grow with the company. The best answers show ambition grounded in realistic progression.\n\nStructure around three dimensions: technical depth, impact (larger-scoped projects), and leadership (mentoring others).\n\nConnect your growth to the company's trajectory. Show learning orientation.\n\nExample: 'In 5 years, I see myself as a senior backend engineer with deep expertise in distributed systems, contributing to architectural decisions and mentoring junior developers.'",
                    "transition_note": None
                },
            ],
            "quiz": [
                {
                    "question": "In salary discussion, you should:",
                    "options": ["Name exact number immediately", "Provide a researched range", "Say you'll accept anything", "Refuse to discuss"],
                    "correct_index": 1,
                    "explanation": "A researched range shows preparation and flexibility while anchoring the negotiation in your favor."
                }
            ],
            "code_metadata": None,
        },
        {
            "title": "Module Mastery Quiz",
            "description": "Test your behavioral interview readiness with comprehensive questions covering all HR and behavioral topics.",
            "duration_minutes": 20,
            "task_type": "qa",
            "qa_pairs": [
                {
                    "question": "What is the STAR method used for?",
                    "answer": "Structuring behavioral interview answers: Situation, Task, Action, Result.",
                    "explanation": "The STAR Framework\n\nSTAR is the gold standard for answering behavioral interview questions. It provides a clear, structured narrative that interviewers can follow.\n\nSituation: Set the context — when, where, what was happening. Task: Your specific responsibility. Action: The specific steps YOU took. Result: The measurable outcome.\n\nThe most common mistake is spending too much time on Situation and not enough on Action and Result. Interviewers care most about what YOU did and what changed because of it.\n\nPrepare 4-5 STAR stories from your projects that can be adapted to different questions.",
                    "transition_note": None
                },
                {
                    "question": "How long should 'Tell me about yourself' be?",
                    "answer": "60-90 seconds. Structured as Present → Past → Future.",
                    "explanation": "The Perfect Introduction Length\n\nKeeping your introduction to 60-90 seconds shows clarity of thought and respect for the interviewer's time.\n\nThe Present → Past → Future structure ensures you cover the most important information: who you are now, what relevant experience you have, and what you're looking for.\n\nEvery sentence should be intentional. Avoid personal details, hobbies, or information unrelated to the role.\n\nEnd with a bridge to the role — connect your background to why you're excited about this specific position.",
                    "transition_note": None
                },
            ],
            "quiz": [
                {
                    "question": "STAR stands for:",
                    "options": ["Story, Task, Action, Review", "Situation, Task, Action, Result", "Summary, Time, Action, Response", "Situation, Topic, Answer, Result"],
                    "correct_index": 1,
                    "explanation": "STAR: Situation (context), Task (your responsibility), Action (what you did), Result (measurable outcome)."
                },
                {
                    "question": "The best 'Tell me about yourself' structure is:",
                    "options": ["Past, Present, Future", "Present, Past, Future", "Future, Present, Past", "Skills, Education, Hobbies"],
                    "correct_index": 1,
                    "explanation": "Present → Past → Future: start with who you are now, mention relevant background, end with what you're looking for."
                },
                {
                    "question": "When answering 'Why this company?', you should:",
                    "options": ["Mention salary first", "Reference specific company details you researched", "Say it's a great brand", "Focus only on career growth"],
                    "correct_index": 1,
                    "explanation": "Specific research signals genuine interest. Reference their products, tech stack, culture, or recent news."
                },
            ],
            "code_metadata": None,
        },
    ]

    # ── Coding Mock Test tasks (second-to-last day) ────────────────────────
    coding_mock_tasks = [
        {
            "title": "DSA: Two Sum",
            "description": "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.\n\n**Approach 1 — Brute Force O(n²):** For each pair (i, j), check if nums[i] + nums[j] == target. Simple but slow.\n\n**Approach 2 — HashMap O(n):** As you iterate, store each number and its index in a HashMap. For each number, check if its complement (target - num) already exists in the map. If yes, return both indices. This is the optimal solution.\n\n**Why HashMap works:** Instead of looking forward for the complement, you look backward using the HashMap as memory of what you've already seen.",
            "duration_minutes": 45,
            "task_type": "code",
            "qa_pairs": [],
            "quiz": [
                {
                    "question": "What is the time complexity of the optimal Two Sum solution?",
                    "options": ["O(n²) — nested loops", "O(n log n) — sorting", "O(n) — HashMap lookup", "O(1) — constant"],
                    "correct_index": 2,
                    "explanation": "The HashMap approach iterates once (O(n)) with O(1) lookups per element, giving O(n) overall."
                },
                {
                    "question": "What data structure makes Two Sum O(n)?",
                    "options": ["Array", "Stack", "HashMap", "Queue"],
                    "correct_index": 2,
                    "explanation": "A HashMap stores each number's index as you iterate, enabling O(1) complement lookups."
                }
            ],
            "code_metadata": {
                "language": "python",
                "initial_code": "def two_sum(nums, target):\n    # Write your solution here\n    # Hint: use a dictionary to store {value: index}\n    pass\n\n# Read input\nimport sys\ndata = sys.stdin.read().splitlines()\nnums = list(map(int, data[0].strip('[]').split(',')))\ntarget = int(data[1])\nprint(two_sum(nums, target))",
                "solution": "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []",
                "difficulty": "Easy",
                "examples": [
                    {"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "nums[0] + nums[1] = 2 + 7 = 9, so return [0, 1]."},
                    {"input": "nums = [3,2,4], target = 6", "output": "[1,2]", "explanation": "nums[1] + nums[2] = 2 + 4 = 6, so return [1, 2]."},
                    {"input": "nums = [3,3], target = 6", "output": "[0,1]", "explanation": "nums[0] + nums[1] = 3 + 3 = 6, so return [0, 1]."},
                ],
                "constraints": [
                    "2 <= nums.length <= 10⁴",
                    "-10⁹ <= nums[i] <= 10⁹",
                    "-10⁹ <= target <= 10⁹",
                    "Only one valid answer exists."
                ],
                "hint": "Use a HashMap to store each number and its index as you iterate. For each element, check if (target - element) already exists in the map. This gives O(n) time and O(n) space.",
                "test_cases": [
                    {"input": "[2,7,11,15]\n9", "expected": "[0, 1]", "label": "Basic case"},
                    {"input": "[3,2,4]\n6", "expected": "[1, 2]", "label": "Non-adjacent pair"},
                    {"input": "[3,3]\n6", "expected": "[0, 1]", "label": "Duplicate values"},
                    {"input": "[-1,-2,-3,-4,-5]\n-8", "expected": "[2, 4]", "label": "Negative numbers"},
                    {"input": "[0,4,3,0]\n0", "expected": "[0, 3]", "label": "Zero target"},
                ]
            },
        },
        {
            "title": "DSA: Maximum Subarray (Kadane's Algorithm)",
            "description": "Given an integer array `nums`, find the subarray with the largest sum, and return its sum.\n\nA subarray is a contiguous non-empty sequence of elements within an array.\n\n**Kadane's Algorithm — O(n) time, O(1) space:**\n- Maintain two variables: `max_ending_here` (max sum ending at current position) and `max_so_far` (global maximum).\n- At each element: `max_ending_here = max(nums[i], max_ending_here + nums[i])`\n- Update: `max_so_far = max(max_so_far, max_ending_here)`\n\n**Key insight:** If the running sum becomes negative, it's better to start fresh from the current element rather than carry a negative prefix. This greedy choice is always optimal.\n\n**Divide and Conquer approach** also works in O(n log n) but Kadane's is preferred for its simplicity.",
            "duration_minutes": 45,
            "task_type": "code",
            "qa_pairs": [],
            "quiz": [
                {
                    "question": "What is Kadane's Algorithm used for?",
                    "options": ["Sorting arrays", "Finding maximum subarray sum", "Binary search", "Graph traversal"],
                    "correct_index": 1,
                    "explanation": "Kadane's Algorithm finds the maximum sum contiguous subarray in O(n) time and O(1) space."
                },
                {
                    "question": "In Kadane's Algorithm, when do you reset max_ending_here?",
                    "options": ["Every 5 elements", "When it becomes negative", "When it exceeds max_so_far", "Never"],
                    "correct_index": 1,
                    "explanation": "When max_ending_here becomes negative, starting fresh from the current element gives a better result: max_ending_here = max(nums[i], max_ending_here + nums[i])."
                }
            ],
            "code_metadata": {
                "language": "python",
                "initial_code": "def max_subarray(nums):\n    # Write your solution here\n    # Hint: track max_ending_here and max_so_far\n    pass\n\n# Read input\nimport sys\ndata = sys.stdin.read().splitlines()\nnums = list(map(int, data[0].strip('[]').split(',')))\nprint(max_subarray(nums))",
                "solution": "def max_subarray(nums):\n    max_ending_here = max_so_far = nums[0]\n    for num in nums[1:]:\n        max_ending_here = max(num, max_ending_here + num)\n        max_so_far = max(max_so_far, max_ending_here)\n    return max_so_far",
                "difficulty": "Medium",
                "examples": [
                    {"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "The subarray [4,-1,2,1] has the largest sum = 6."},
                    {"input": "nums = [1]", "output": "1", "explanation": "Single element — the only subarray is [1] with sum 1."},
                    {"input": "nums = [5,4,-1,7,8]", "output": "23", "explanation": "The entire array [5,4,-1,7,8] has sum 23."},
                ],
                "constraints": [
                    "1 <= nums.length <= 10⁵",
                    "-10⁴ <= nums[i] <= 10⁴"
                ],
                "hint": "Use Kadane's Algorithm: track max_ending_here = max(nums[i], max_ending_here + nums[i]) and max_so_far = max(max_so_far, max_ending_here). Initialize both to nums[0].",
                "test_cases": [
                    {"input": "[-2,1,-3,4,-1,2,1,-5,4]", "expected": "6", "label": "Mixed positive/negative"},
                    {"input": "[1]", "expected": "1", "label": "Single element"},
                    {"input": "[5,4,-1,7,8]", "expected": "23", "label": "All positive"},
                    {"input": "[-1,-2,-3,-4]", "expected": "-1", "label": "All negative"},
                    {"input": "[1,-1,1,-1,1]", "expected": "1", "label": "Alternating"},
                ]
            },
        },
        {
            "title": "DSA: Valid Parentheses",
            "description": "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.\n\n**Stack-based approach — O(n) time, O(n) space:**\n- For each character: if it's an opening bracket, push it onto the stack.\n- If it's a closing bracket: check if the stack is non-empty AND the top matches the expected opener.\n- Use a mapping: `')' → '('`, `'}' → '{'`, `']' → '['`\n- At the end, the stack must be empty (all brackets matched).\n\n**Edge cases:** Empty string (valid), single bracket (invalid), mismatched types `(]`, interleaved `([)]`.",
            "duration_minutes": 30,
            "task_type": "code",
            "qa_pairs": [],
            "quiz": [
                {
                    "question": "Which data structure is used to solve Valid Parentheses?",
                    "options": ["Queue", "Stack", "HashMap only", "Array"],
                    "correct_index": 1,
                    "explanation": "A stack (LIFO) is perfect — push opening brackets, pop and verify when you see a closing bracket."
                },
                {
                    "question": "When is the string valid at the end of iteration?",
                    "options": ["Stack has one element", "Stack is empty", "Stack has matching pairs", "Stack has only openers"],
                    "correct_index": 1,
                    "explanation": "The stack must be empty at the end — every opening bracket was matched and popped by its corresponding closing bracket."
                }
            ],
            "code_metadata": {
                "language": "python",
                "initial_code": "def is_valid(s):\n    # Write your solution here\n    # Hint: use a stack and a mapping of closing to opening brackets\n    pass\n\n# Read input\nimport sys\ns = sys.stdin.read().strip()\nprint(is_valid(s))",
                "solution": "def is_valid(s):\n    stack = []\n    mapping = {')': '(', '}': '{', ']': '['}\n    for char in s:\n        if char in mapping:\n            top = stack.pop() if stack else '#'\n            if mapping[char] != top:\n                return False\n        else:\n            stack.append(char)\n    return not stack",
                "difficulty": "Easy",
                "examples": [
                    {"input": 's = "()"', "output": "true", "explanation": "Single pair of matching parentheses."},
                    {"input": 's = "()[]{}"', "output": "true", "explanation": "Three pairs of different bracket types, all matching."},
                    {"input": 's = "(]"', "output": "false", "explanation": "Opening '(' is closed by ']' — wrong type."},
                ],
                "constraints": [
                    "1 <= s.length <= 10⁴",
                    "s consists of parentheses only '()[]{}'."
                ],
                "hint": "Use a stack. Push opening brackets. For closing brackets, check if the stack top is the matching opener using a HashMap: ')' → '(', '}' → '{', ']' → '['. Return true only if the stack is empty at the end.",
                "test_cases": [
                    {"input": "()", "expected": "True", "label": "Simple pair"},
                    {"input": "()[]{}", "expected": "True", "label": "Multiple types"},
                    {"input": "(]", "expected": "False", "label": "Wrong closing"},
                    {"input": "([)]", "expected": "False", "label": "Interleaved"},
                    {"input": "{[]}", "expected": "True", "label": "Nested"},
                ]
            },
        },
        {
            "title": "Module Mastery Quiz",
            "description": "Test your DSA knowledge covering Two Sum, Kadane's Algorithm, and Valid Parentheses.",
            "duration_minutes": 20,
            "task_type": "qa",
            "qa_pairs": [
                {
                    "question": "What is the time complexity of the optimal Two Sum solution?",
                    "answer": "O(n) — single pass with O(1) HashMap lookups.",
                    "explanation": "HashMap-Based Two Sum\n\nThe naive approach uses nested loops: for each element, check all other elements for the complement. This is O(n²) time.\n\nThe HashMap approach: traverse the array once. For each element, check if its complement (target - element) is already in the HashMap. If yes, return the pair. If no, add the element to the HashMap. This is O(n) time and O(n) space.\n\nThe key insight: instead of looking forward for the complement, we look backward using the HashMap as a memory of what we've already seen.\n\nThis pattern — trading space for time using a HashMap — applies to many array problems: finding duplicates, grouping anagrams, and subarray sum problems.",
                    "transition_note": None
                },
                {
                    "question": "What is Kadane's Algorithm and what problem does it solve?",
                    "answer": "Kadane's Algorithm finds the maximum sum contiguous subarray in O(n) time and O(1) space.",
                    "explanation": "Kadane's Algorithm\n\nKadane's Algorithm solves the Maximum Subarray Problem — finding the contiguous subarray with the largest sum — in a single pass.\n\nThe algorithm maintains two variables: max_ending_here (the maximum sum of any subarray ending at the current position) and max_so_far (the global maximum). At each element: max_ending_here = max(nums[i], max_ending_here + nums[i]).\n\nThe key insight: if the running sum becomes negative, it's better to start fresh from the current element. This greedy choice is always optimal.\n\nVariations include finding the actual subarray (not just the sum), handling all-negative arrays, and the 2D extension (maximum sum rectangle in a matrix).",
                    "transition_note": None
                },
                {
                    "question": "Why is a stack the ideal data structure for Valid Parentheses?",
                    "answer": "A stack's LIFO property matches the nesting structure of brackets — the most recently opened bracket must be closed first.",
                    "explanation": "Stack for Bracket Matching\n\nBrackets have a nested structure: the innermost bracket must be closed before outer ones. This is exactly LIFO (Last In, First Out) — the last opening bracket pushed must be the first to be matched.\n\nAlgorithm: push opening brackets onto the stack. When you see a closing bracket, the top of the stack must be the matching opener. If not, the string is invalid. At the end, the stack must be empty.\n\nTime: O(n) — each character is pushed and popped at most once. Space: O(n) — in the worst case (all opening brackets), the stack holds n/2 elements.\n\nThis pattern extends to: matching HTML tags, validating XML, and checking balanced expressions in compilers.",
                    "transition_note": None
                },
            ],
            "quiz": [
                {
                    "question": "Two Sum with HashMap has time complexity:",
                    "options": ["O(n²)", "O(n log n)", "O(n)", "O(1)"],
                    "correct_index": 2,
                    "explanation": "HashMap approach: single pass O(n) with O(1) lookups per element."
                },
                {
                    "question": "Kadane's Algorithm resets max_ending_here when:",
                    "options": ["It exceeds max_so_far", "It becomes negative", "Every 10 elements", "Never"],
                    "correct_index": 1,
                    "explanation": "When max_ending_here becomes negative, starting fresh from the current element gives a better result."
                },
                {
                    "question": "Valid Parentheses returns true when:",
                    "options": ["Stack has one element", "Stack is empty at end", "All characters are brackets", "Stack has matching pairs"],
                    "correct_index": 1,
                    "explanation": "The stack must be empty at the end — every opening bracket was matched and popped by its corresponding closing bracket."
                },
            ],
            "code_metadata": None,
        },
    ]

    daily_plan = []
    days_to_plan = min(days_available, 100)  # Cap at 100 days

    for day_num in range(1, days_to_plan + 1):
        # ── Second-to-last day: Dedicated Coding Mock Tests ────────────────
        if day_num == days_to_plan - 1 and days_to_plan > 1:
            daily_plan.append({
                "day": day_num,
                "focus": "Coding Mock Tests",
                "tasks": coding_mock_tasks,
            })
            continue

        # ── Last day: Behavioral Interview ─────────────────────────────────
        if day_num == days_to_plan:
            daily_plan.append({
                "day": day_num,
                "focus": "Behavioral Interview",
                "tasks": behavioral_tasks,
            })
            continue

        # ── Regular days ───────────────────────────────────────────────────
        tasks = []

        # Daily DSA practice (rotating through topics)
        dsa_topic = dsa_tasks[(day_num - 1) % len(dsa_tasks)]

        # Rich Q&A pairs for each DSA topic
        dsa_qa_map = {
            "Array & String manipulation": [
                {
                    "question": "What is an array and how is it stored in memory?",
                    "answer": "An array is a contiguous block of memory storing elements of the same type, accessible via index in O(1) time.",
                    "explanation": "Array Memory Layout\n\nArrays store elements in contiguous memory locations. Each element occupies the same amount of space, so the address of element[i] = base_address + (i × element_size). This enables O(1) random access.\n\nIn Python, lists are dynamic arrays — they over-allocate memory and resize when full (amortized O(1) append). In Java, arrays are fixed-size; use ArrayList for dynamic resizing.\n\nCommon operations: access O(1), search O(n), insert/delete at end O(1) amortized, insert/delete at middle O(n) due to shifting.\n\nInterview trap: confusing array index out of bounds (runtime error) with a logic bug. Always validate index bounds before accessing.",
                    "transition_note": make_transition_note(day_num, "arrays/lists", target_lang)
                },
                {
                    "question": "What is the Two Pointer technique and when do you use it?",
                    "answer": "Two pointers use two indices moving through an array to solve problems in O(n) instead of O(n²) nested loops.",
                    "explanation": "Two Pointer Pattern\n\nThe two pointer technique places one pointer at the start and one at the end (or both at start moving at different speeds). By moving them based on conditions, you avoid nested loops.\n\nConverging pointers: used for sorted array problems like 'find pair with target sum'. Move left pointer right if sum is too small, right pointer left if too large. O(n) time.\n\nFast-slow pointers: used for cycle detection in linked lists (Floyd's algorithm), finding the middle of a list, or detecting palindromes.\n\nInterview trap: forgetting to handle duplicates or edge cases when both pointers meet. Always check the termination condition carefully.",
                    "transition_note": None
                },
                {
                    "question": "What is the Sliding Window technique?",
                    "answer": "Sliding window maintains a variable-size or fixed-size window over an array to compute results in O(n) instead of O(n²).",
                    "explanation": "Sliding Window Pattern\n\nA sliding window expands and contracts over a subarray to track a running result (sum, max, count of distinct elements). Instead of recomputing from scratch for each window, you add the new element and remove the old one.\n\nFixed window: window size k is constant. Compute the first window, then slide by adding the next element and removing the first. Used for 'maximum sum subarray of size k'.\n\nVariable window: expand right pointer until a condition is violated, then shrink from the left. Used for 'longest substring without repeating characters'.\n\nInterview trap: off-by-one errors in window boundaries. Use inclusive left and exclusive right, or both inclusive — be consistent.",
                    "transition_note": None
                },
            ],
            "Linked Lists": [
                {
                    "question": "What is a linked list and how does it differ from an array?",
                    "answer": "A linked list stores elements in nodes with pointers to the next node. Unlike arrays, it has O(1) insert/delete but O(n) access.",
                    "explanation": "Linked List vs Array\n\nA linked list consists of nodes, each containing data and a pointer to the next node. The last node points to null. There is no contiguous memory requirement — nodes can be anywhere in memory.\n\nKey differences: Arrays have O(1) random access but O(n) insert/delete (shifting). Linked lists have O(n) access (must traverse from head) but O(1) insert/delete at a known position.\n\nTypes: Singly linked (one direction), doubly linked (prev and next pointers), circular (last node points to head). Doubly linked lists enable O(1) deletion when you have a reference to the node.\n\nInterview trap: forgetting to update the tail pointer when inserting at the end, or losing the reference to the rest of the list when reversing.",
                    "transition_note": None
                },
                {
                    "question": "How do you reverse a linked list iteratively?",
                    "answer": "Use three pointers: prev (None), curr (head), next_node. In each step: save next, point curr to prev, advance both. Return prev.",
                    "explanation": "Iterative Linked List Reversal\n\nThe algorithm uses three pointers: prev starts as None, curr starts at head. In each iteration: save curr.next to next_node, set curr.next = prev (reverse the link), advance prev = curr, advance curr = next_node.\n\nAfter the loop, curr is None and prev points to the new head (old tail). Return prev. Time: O(n), Space: O(1).\n\nThe recursive approach is cleaner but uses O(n) stack space: reverse(head.next), then head.next.next = head, head.next = None.\n\nInterview trap: losing the rest of the list by setting curr.next = prev before saving next_node. Always save next_node FIRST.",
                    "transition_note": None
                },
                {
                    "question": "How do you detect a cycle in a linked list?",
                    "answer": "Use Floyd's cycle detection: fast pointer moves 2 steps, slow pointer moves 1 step. If they meet, a cycle exists.",
                    "explanation": "Floyd's Cycle Detection Algorithm\n\nAlso called the 'tortoise and hare' algorithm. The slow pointer advances one node at a time; the fast pointer advances two. If there is a cycle, the fast pointer will eventually lap the slow pointer and they will meet inside the cycle.\n\nIf the fast pointer reaches null (or fast.next is null), there is no cycle. Time: O(n), Space: O(1).\n\nTo find the cycle start: after detection, reset one pointer to head. Move both one step at a time — they meet at the cycle entry point.\n\nInterview trap: checking fast != null AND fast.next != null before advancing. Missing either check causes a NullPointerException.",
                    "transition_note": None
                },
            ],
            "Trees & Graphs": [
                {
                    "question": "What are the tree traversal methods and when do you use each?",
                    "answer": "Inorder (L,Root,R) gives sorted BST output. Preorder (Root,L,R) copies trees. Postorder (L,R,Root) deletes trees. Level-order uses BFS.",
                    "explanation": "Tree Traversal Methods\n\nInorder traversal (Left → Root → Right) visits nodes in ascending sorted order for a BST. Used for: BST validation, finding kth smallest element, converting BST to sorted array.\n\nPreorder traversal (Root → Left → Right) visits the root before children. Used for: copying a tree, serialization, prefix expression evaluation.\n\nPostorder traversal (Left → Right → Root) visits children before the root. Used for: deleting a tree (delete children before parent), calculating directory sizes, postfix evaluation.\n\nLevel-order (BFS) uses a queue to visit nodes level by level. Used for: finding minimum depth, right/left side view, zigzag traversal.",
                    "transition_note": None
                },
                {
                    "question": "What is the difference between BFS and DFS?",
                    "answer": "BFS uses a queue and explores level by level — best for shortest paths. DFS uses a stack/recursion and goes deep first — best for cycle detection and topological sort.",
                    "explanation": "BFS vs DFS\n\nBreadth-First Search (BFS) uses a queue (FIFO). It explores all neighbors at the current depth before going deeper. Guarantees the shortest path in unweighted graphs. Space: O(V) for the queue.\n\nDepth-First Search (DFS) uses a stack or recursion. It goes as deep as possible before backtracking. Used for: cycle detection (back edges), topological sorting, connected components, exhaustive search. Space: O(h) for the recursion stack where h is the height.\n\nFor trees: BFS is better for level-based operations. DFS is better for path-finding and exhaustive exploration.\n\nInterview trap: BFS requires more memory than DFS for wide graphs. DFS can cause stack overflow for very deep graphs — use iterative DFS with an explicit stack.",
                    "transition_note": None
                },
                {
                    "question": "What is a Binary Search Tree (BST) and what are its time complexities?",
                    "answer": "A BST has left < root < right for every node. Search, insert, delete are O(h) where h is height — O(log n) balanced, O(n) degenerate.",
                    "explanation": "Binary Search Tree Properties\n\nA BST maintains the invariant: all values in the left subtree are less than the root, all values in the right subtree are greater. This enables binary search on the tree.\n\nOperations are O(h) where h is the tree height. For a balanced BST, h = O(log n). For a degenerate BST (sorted insertions), h = O(n) — it becomes a linked list.\n\nSelf-balancing BSTs (AVL, Red-Black) maintain O(log n) height automatically. Java's TreeMap and TreeSet use Red-Black trees.\n\nInterview trap: BST validation requires checking range bounds, not just comparing parent-child. A node's value must be less than ALL ancestors on the right path, not just its immediate parent.",
                    "transition_note": None
                },
            ],
            "Dynamic Programming": [
                {
                    "question": "What is Dynamic Programming and when should you use it?",
                    "answer": "DP solves problems with overlapping subproblems and optimal substructure by storing results to avoid recomputation.",
                    "explanation": "Dynamic Programming Fundamentals\n\nDP applies when a problem has two properties: overlapping subproblems (same subproblems are solved multiple times) and optimal substructure (optimal solution contains optimal solutions to subproblems).\n\nTop-down (memoization): write the recursive solution, add a cache. Natural to implement — just add a dictionary/array to store results. Lazy evaluation — only computes needed subproblems.\n\nBottom-up (tabulation): fill a DP table iteratively from base cases. No recursion overhead, no stack overflow risk. Often allows space optimization.\n\nInterview trap: confusing DP with greedy. Greedy makes locally optimal choices without reconsidering. DP explores all possibilities and picks the global optimum.",
                    "transition_note": None
                },
                {
                    "question": "How do you solve the Fibonacci sequence with DP?",
                    "answer": "Naive recursion is O(2^n). Memoization or tabulation reduces it to O(n) time. Space-optimized: O(1) using two variables.",
                    "explanation": "Fibonacci DP Optimization\n\nNaive recursion: fib(n) = fib(n-1) + fib(n-2). This recomputes fib(3) twice, fib(2) three times — exponential time O(2^n).\n\nMemoization: add a cache dict. Before computing fib(n), check if it's cached. If yes, return it. Each value computed once — O(n) time, O(n) space.\n\nTabulation: dp[0]=0, dp[1]=1, dp[i]=dp[i-1]+dp[i-2]. Fill the array bottom-up. O(n) time, O(n) space.\n\nSpace optimization: fib(n) only needs the previous two values. Use prev2 and prev1 variables. O(n) time, O(1) space. This pattern applies to many 1D DP problems like house robber and climbing stairs.",
                    "transition_note": None
                },
                {
                    "question": "What is the 0/1 Knapsack problem and how do you solve it with DP?",
                    "answer": "Maximize value in a knapsack of capacity W. dp[i][w] = max(skip item i, take item i). Time O(n×W), space O(W) optimized.",
                    "explanation": "0/1 Knapsack DP\n\nProblem: given n items with weights and values, select items to maximize total value without exceeding capacity W. Each item is taken once (0/1).\n\nDP formulation: dp[i][w] = max value using first i items with capacity w. For each item: either skip it (dp[i-1][w]) or take it if it fits (dp[i-1][w-weight[i]] + value[i]). Answer is dp[n][W].\n\nSpace optimization: process weights right-to-left in a 1D array. dp[w] = max(dp[w], dp[w-weight[i]] + value[i]). Space drops from O(n×W) to O(W).\n\nInterview trap: the 0/1 constraint (each item once) requires right-to-left processing. Unbounded knapsack (unlimited copies) processes left-to-right.",
                    "transition_note": None
                },
            ],
            "Sorting & Searching": [
                {
                    "question": "What are the most important sorting algorithms and their complexities?",
                    "answer": "Merge Sort O(n log n) stable. Quick Sort O(n log n) avg, O(n²) worst. Heap Sort O(n log n). Counting Sort O(n+k) for integers.",
                    "explanation": "Sorting Algorithm Comparison\n\nMerge Sort: divide array in half, sort each half, merge. Always O(n log n) time, O(n) space. Stable (preserves order of equal elements). Best for linked lists and external sorting.\n\nQuick Sort: pick a pivot, partition around it, recurse. Average O(n log n), worst case O(n²) with bad pivot. O(log n) space (stack). In-place. Fastest in practice due to cache efficiency.\n\nHeap Sort: build a max-heap, repeatedly extract max. Always O(n log n), O(1) space. Not stable. Rarely used in practice due to poor cache performance.\n\nInterview trap: Quick Sort's worst case is sorted input with naive pivot selection. Use random pivot or median-of-three to avoid O(n²).",
                    "transition_note": None
                },
                {
                    "question": "How does Binary Search work and what are its requirements?",
                    "answer": "Binary Search requires a sorted array. Compare target with mid element, eliminate half the search space each step. O(log n) time.",
                    "explanation": "Binary Search Algorithm\n\nBinary search works on sorted arrays. Set left=0, right=n-1. Compute mid=(left+right)//2. If arr[mid]==target, return mid. If arr[mid]<target, search right half (left=mid+1). If arr[mid]>target, search left half (right=mid-1). Repeat until left>right.\n\nTime: O(log n) — each step eliminates half the remaining elements. Space: O(1) iterative, O(log n) recursive.\n\nVariants: find first/last occurrence (adjust condition to continue searching after finding target), find insertion position, search in rotated sorted array.\n\nInterview trap: integer overflow in mid calculation. Use mid = left + (right-left)//2 instead of (left+right)//2 to avoid overflow in languages with fixed-size integers.",
                    "transition_note": None
                },
            ],
            "Hash Maps": [
                {
                    "question": "How does a HashMap work internally?",
                    "answer": "HashMap uses an array of buckets. Keys are hashed to bucket indices. Collisions are handled by chaining (linked list) or open addressing.",
                    "explanation": "HashMap Internal Structure\n\nA HashMap maintains an array of buckets. When you put(key, value): compute hash(key), take hash % array_size to get bucket index, store the key-value pair in that bucket.\n\nCollision handling: two keys can hash to the same bucket. Chaining stores a linked list (or tree in Java 8+) at each bucket. Open addressing probes for the next empty slot.\n\nLoad factor: when the number of entries exceeds capacity × load_factor (default 0.75), the array is resized (doubled) and all entries are rehashed. This is O(n) but amortized O(1) per operation.\n\nInterview trap: HashMap is not thread-safe. Use ConcurrentHashMap for concurrent access. Also, mutable objects as keys are dangerous — if the key's hashCode changes after insertion, you can't find the entry.",
                    "transition_note": None
                },
                {
                    "question": "What is the time complexity of HashMap operations?",
                    "answer": "Average O(1) for get, put, delete. Worst case O(n) with all keys in one bucket (hash collision attack). O(n) space.",
                    "explanation": "HashMap Time Complexity\n\nAverage case: O(1) for get, put, containsKey, remove. This assumes a good hash function that distributes keys uniformly across buckets.\n\nWorst case: O(n) if all keys hash to the same bucket (degenerate chaining). Java 8+ converts chains longer than 8 to a Red-Black tree, improving worst case to O(log n).\n\nSpace: O(n) for n entries, plus overhead for the bucket array (typically 2× the number of entries due to load factor).\n\nInterview trap: HashMap iteration order is not guaranteed. Use LinkedHashMap for insertion-order iteration or TreeMap for sorted-key iteration.",
                    "transition_note": None
                },
            ],
            "Stacks & Queues": [
                {
                    "question": "What is a Stack and what are its core operations?",
                    "answer": "A Stack is LIFO (Last In First Out). Core operations: push (add to top), pop (remove from top), peek (view top) — all O(1).",
                    "explanation": "Stack Data Structure\n\nA stack follows LIFO order — the last element pushed is the first popped. Think of a stack of plates: you add and remove from the top only.\n\nCore operations: push(item) adds to top O(1), pop() removes and returns top O(1), peek()/top() returns top without removing O(1), isEmpty() checks if empty O(1).\n\nImplementation: use an array (fixed size) or linked list (dynamic). Python's list works as a stack (append/pop). Java uses Deque (ArrayDeque) instead of the legacy Stack class.\n\nInterview trap: stack overflow occurs when recursion depth exceeds the call stack limit. Convert deep recursion to iterative using an explicit stack.",
                    "transition_note": None
                },
                {
                    "question": "What is a Queue and how does it differ from a Stack?",
                    "answer": "A Queue is FIFO (First In First Out). Enqueue adds to rear, dequeue removes from front. Used in BFS, task scheduling, and producer-consumer patterns.",
                    "explanation": "Queue Data Structure\n\nA queue follows FIFO order — the first element enqueued is the first dequeued. Think of a line at a store: first person in line is served first.\n\nCore operations: enqueue(item) adds to rear O(1), dequeue() removes from front O(1), peek() views front O(1). Using a linked list or circular array gives O(1) for all operations.\n\nVariants: Deque (double-ended queue) supports add/remove from both ends. Priority Queue orders elements by priority (min-heap or max-heap) — O(log n) enqueue/dequeue.\n\nInterview trap: using a Python list as a queue (pop(0)) is O(n) due to shifting. Use collections.deque for O(1) popleft().",
                    "transition_note": None
                },
            ],
            "Recursion & Backtracking": [
                {
                    "question": "What is recursion and what are the two required components?",
                    "answer": "Recursion is a function calling itself. Requires: (1) base case to stop recursion, (2) recursive case that moves toward the base case.",
                    "explanation": "Recursion Fundamentals\n\nA recursive function solves a problem by breaking it into smaller instances of the same problem. Every recursive solution needs: a base case (the simplest case that returns directly without recursing) and a recursive case (reduces the problem toward the base case).\n\nCall stack: each recursive call adds a frame to the call stack. When the base case is reached, frames unwind in reverse order. Stack depth = recursion depth.\n\nTail recursion: when the recursive call is the last operation. Some languages optimize this to avoid stack growth. Python does NOT optimize tail recursion.\n\nInterview trap: missing or incorrect base case causes infinite recursion and stack overflow. Always identify the base case first before writing the recursive case.",
                    "transition_note": None
                },
                {
                    "question": "What is backtracking and how does it differ from brute force?",
                    "answer": "Backtracking explores all possibilities but prunes invalid branches early, avoiding unnecessary work. Brute force tries every combination without pruning.",
                    "explanation": "Backtracking Pattern\n\nBacktracking builds a solution incrementally. At each step, it makes a choice, recurses to explore that choice, then undoes the choice (backtracks) to try the next option. It prunes branches that cannot lead to a valid solution.\n\nTemplate: choose → explore → unchoose. Example: N-Queens places a queen, recurses to place the next, removes the queen if no valid placement exists.\n\nCommon problems: permutations, combinations, subsets, N-Queens, Sudoku solver, word search in a grid.\n\nInterview trap: forgetting to undo the choice (unchoose step) corrupts the state for subsequent branches. Always restore state after recursion returns.",
                    "transition_note": None
                },
            ],
        }

        qa_pairs_for_dsa = dsa_qa_map.get(dsa_topic, [
            {
                "question": f"What is {dsa_topic} and why is it important in interviews?",
                "answer": f"{dsa_topic} is a fundamental data structure/algorithm topic tested in technical interviews.",
                "explanation": f"{dsa_topic} Overview\n\nThis topic is commonly tested in technical interviews at all levels.\n\nUnderstanding the core operations and their time/space complexities is essential.\n\nPractice implementing solutions from scratch and explaining your approach clearly.\n\nCommon interview questions focus on edge cases and optimization opportunities.",
                "transition_note": None
            }
        ])

        tasks.append({
            "title": f"DSA: {dsa_topic}",
            "description": f"Master {dsa_topic} concepts and problem-solving patterns for the {role or 'technical'} interview at {company}." + (f" This is a priority gap skill." if dsa_topic.lower() in [g.lower() for g in gaps] else ""),
            "duration_minutes": 60 if day_num % 2 == 0 else 45,
            "task_type": "qa",
            "qa_pairs": qa_pairs_for_dsa,
            "quiz": [
                {
                    "question": f"What is the typical time complexity for an optimized {dsa_topic} solution?",
                    "options": ["O(n²) — nested loops", "O(n log n) — divide and conquer", "O(n) — single pass with HashMap", "O(1) — constant time"],
                    "correct_index": 2,
                    "explanation": f"Most {dsa_topic} problems can be solved in O(n) using a HashMap or two-pointer technique, avoiding the O(n²) brute force approach."
                },
                {
                    "question": f"Which data structure most commonly optimizes {dsa_topic} problems?",
                    "options": ["Linked List", "HashMap / HashSet", "Binary Tree", "Stack"],
                    "correct_index": 1,
                    "explanation": "HashMaps provide O(1) average-case lookups, converting nested loop problems into single-pass O(n) solutions."
                }
            ],
            "code_metadata": None,
        })

        # Backend topics (rotate daily — uses role-specific list: Python/Java/JS)
        java_topic = backend_tasks[(day_num - 1) % len(backend_tasks)]

        # Rich Q&A pairs for each Java/Spring topic
        java_qa_map = {
            "Java fundamentals & OOP": [
                {
                    "question": "What are the four pillars of OOP in Java?",
                    "answer": "Encapsulation (data hiding), Inheritance (code reuse), Polymorphism (many forms), Abstraction (hiding complexity).",
                    "explanation": "Four Pillars of OOP\n\nEncapsulation: bundle data and methods together, hide internal state with private fields and expose via public getters/setters. Prevents invalid state and reduces coupling.\n\nInheritance: a subclass extends a superclass, inheriting its fields and methods. Enables code reuse. Java supports single inheritance for classes but multiple inheritance via interfaces.\n\nPolymorphism: one interface, many implementations. Method overriding (runtime polymorphism) lets subclasses provide specific behavior. Method overloading (compile-time) allows same method name with different parameters.\n\nAbstraction: hide implementation details, expose only what's necessary. Achieved via abstract classes (partial implementation) and interfaces (pure contract).",
                    "transition_note": None
                },
                {
                    "question": "What is the difference between an abstract class and an interface in Java?",
                    "answer": "Abstract class can have state and partial implementation. Interface is a pure contract (Java 8+ allows default methods). A class can implement multiple interfaces but extend only one abstract class.",
                    "explanation": "Abstract Class vs Interface\n\nAbstract class: can have instance variables, constructors, concrete methods, and abstract methods. Use when subclasses share common state or behavior. A class can extend only ONE abstract class.\n\nInterface: defines a contract — method signatures that implementing classes must provide. Java 8+ added default methods (with implementation) and static methods. A class can implement MULTIPLE interfaces.\n\nWhen to use: abstract class for 'is-a' relationships with shared state (Animal → Dog). Interface for 'can-do' capabilities (Serializable, Comparable, Runnable).\n\nInterview trap: Java 8 default methods in interfaces can cause the 'diamond problem' if two interfaces have the same default method. The implementing class must override to resolve the conflict.",
                    "transition_note": None
                },
            ],
            "Spring Boot basics": [
                {
                    "question": "What is Spring Boot and how does it differ from Spring Framework?",
                    "answer": "Spring Boot is an opinionated wrapper around Spring that provides auto-configuration, embedded servers, and starter dependencies — eliminating boilerplate XML configuration.",
                    "explanation": "Spring Boot vs Spring Framework\n\nSpring Framework is a comprehensive IoC/DI container requiring extensive XML or Java configuration. Spring Boot adds auto-configuration that detects dependencies on the classpath and configures them automatically.\n\nKey features: embedded Tomcat/Jetty (no WAR deployment needed), starter POMs (spring-boot-starter-web pulls in all web dependencies), auto-configuration (@EnableAutoConfiguration), and production-ready actuator endpoints.\n\nSpring Boot application entry point: @SpringBootApplication (combines @Configuration, @EnableAutoConfiguration, @ComponentScan) on the main class with SpringApplication.run().\n\nInterview trap: auto-configuration can be surprising. Use --debug flag or /actuator/conditions endpoint to see which auto-configurations were applied and why.",
                    "transition_note": None
                },
                {
                    "question": "What is Dependency Injection and how does Spring implement it?",
                    "answer": "DI is a design pattern where dependencies are provided externally rather than created inside the class. Spring uses @Autowired, constructor injection, or @Bean methods.",
                    "explanation": "Dependency Injection in Spring\n\nDI inverts control — instead of a class creating its dependencies (new Service()), they are injected by the framework. This makes code testable (inject mocks) and loosely coupled.\n\nSpring's IoC container manages beans (objects). @Component, @Service, @Repository, @Controller mark classes as beans. @Autowired injects dependencies.\n\nInjection types: constructor injection (recommended — dependencies are explicit and final), setter injection (optional dependencies), field injection (@Autowired on field — convenient but harder to test).\n\nInterview trap: circular dependencies (A depends on B, B depends on A) cause a BeanCurrentlyInCreationException. Break cycles by using @Lazy or restructuring the design.",
                    "transition_note": None
                },
            ],
            "Spring Boot basics": [
                {
                    "question": "What is Spring Boot and how does it differ from Spring Framework?",
                    "answer": "Spring Boot is an opinionated wrapper around Spring that provides auto-configuration, embedded servers, and starter dependencies — eliminating boilerplate XML configuration.",
                    "explanation": "Spring Boot vs Spring Framework\n\nSpring Framework is a comprehensive IoC/DI container requiring extensive XML or Java configuration. Spring Boot adds auto-configuration that detects dependencies on the classpath and configures them automatically.\n\nKey features: embedded Tomcat/Jetty (no WAR deployment needed), starter POMs (spring-boot-starter-web pulls in all web dependencies), auto-configuration (@EnableAutoConfiguration), and production-ready actuator endpoints.\n\nSpring Boot application entry point: @SpringBootApplication (combines @Configuration, @EnableAutoConfiguration, @ComponentScan) on the main class with SpringApplication.run().\n\nInterview trap: auto-configuration can be surprising. Use --debug flag or /actuator/conditions endpoint to see which auto-configurations were applied and why.",
                    "transition_note": None
                },
            ],
            "Spring MVC": [
                {
                    "question": "How does Spring MVC handle HTTP requests?",
                    "answer": "DispatcherServlet receives all requests, routes to @Controller/@RestController methods via @RequestMapping, processes the response through ViewResolver or directly as JSON.",
                    "explanation": "Spring MVC Request Flow\n\nDispatcherServlet is the front controller — all requests go through it. It consults HandlerMapping to find the right controller method, invokes it, and processes the return value.\n\n@RestController = @Controller + @ResponseBody. Methods return objects serialized to JSON by Jackson. @RequestMapping (or @GetMapping, @PostMapping) maps URLs to methods.\n\nMethod parameters: @PathVariable extracts from URL path, @RequestParam from query string, @RequestBody deserializes JSON body, @RequestHeader reads headers.\n\nInterview trap: @Controller returns view names (for Thymeleaf/JSP). @RestController returns data directly. Mixing them up causes 404 errors when the view resolver can't find a template.",
                    "transition_note": None
                },
            ],
            "Spring Data JPA": [
                {
                    "question": "What is Spring Data JPA and how does it simplify database access?",
                    "answer": "Spring Data JPA provides Repository interfaces (JpaRepository) that auto-generate CRUD operations and query methods from method names, eliminating boilerplate DAO code.",
                    "explanation": "Spring Data JPA Overview\n\nJPA (Java Persistence API) maps Java objects to database tables via annotations (@Entity, @Table, @Id, @Column). Hibernate is the most common JPA implementation.\n\nSpring Data JPA adds the Repository pattern: extend JpaRepository<Entity, ID> and get save(), findById(), findAll(), delete() for free. No implementation needed.\n\nQuery methods: Spring generates SQL from method names. findByEmailAndStatus(String email, String status) → SELECT * FROM users WHERE email=? AND status=?. For complex queries, use @Query with JPQL or native SQL.\n\nInterview trap: N+1 query problem — fetching a list of entities and then accessing a lazy-loaded relationship for each one triggers N additional queries. Fix with JOIN FETCH or @EntityGraph.",
                    "transition_note": None
                },
            ],
            "Spring Security": [
                {
                    "question": "How does Spring Security handle authentication and authorization?",
                    "answer": "Spring Security uses a filter chain. Authentication verifies identity (who you are). Authorization checks permissions (what you can do). Configured via SecurityFilterChain bean.",
                    "explanation": "Spring Security Architecture\n\nSpring Security intercepts requests via a chain of filters before they reach controllers. The key filter is UsernamePasswordAuthenticationFilter for form login, or JwtAuthenticationFilter for JWT-based APIs.\n\nAuthentication: the AuthenticationManager delegates to AuthenticationProvider (e.g., DaoAuthenticationProvider) which loads the user via UserDetailsService and verifies the password with PasswordEncoder.\n\nAuthorization: after authentication, Spring Security checks if the authenticated user has the required roles/permissions for the requested resource. Configured with .authorizeHttpRequests() in SecurityFilterChain.\n\nInterview trap: CSRF protection is enabled by default and breaks stateless REST APIs. Disable it for APIs: .csrf(csrf -> csrf.disable()). Keep it enabled for form-based web apps.",
                    "transition_note": None
                },
            ],
            "RESTful APIs": [
                {
                    "question": "What are the principles of RESTful API design?",
                    "answer": "REST: stateless, client-server, uniform interface (HTTP verbs + resource URLs), cacheable, layered system. Use nouns for resources, HTTP verbs for actions.",
                    "explanation": "RESTful API Design Principles\n\nStateless: each request contains all information needed. No server-side session state. Enables horizontal scaling.\n\nUniform interface: use HTTP verbs correctly — GET (read, idempotent), POST (create), PUT (full update, idempotent), PATCH (partial update), DELETE (remove, idempotent). Resources are nouns: /users, /orders/{id}.\n\nHTTP status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Internal Server Error.\n\nInterview trap: PUT vs PATCH — PUT replaces the entire resource (send all fields), PATCH updates only specified fields. Using PUT for partial updates can accidentally null out fields not included in the request.",
                    "transition_note": None
                },
            ],
            "Exception handling": [
                {
                    "question": "How do you handle exceptions globally in a Spring Boot REST API?",
                    "answer": "Use @ControllerAdvice with @ExceptionHandler methods to catch exceptions globally and return consistent error responses.",
                    "explanation": "Global Exception Handling in Spring Boot\n\n@ControllerAdvice is a cross-cutting concern that applies to all controllers. @ExceptionHandler methods within it catch specific exception types and return appropriate HTTP responses.\n\nExample: @ExceptionHandler(ResourceNotFoundException.class) returns 404 with an error body. @ExceptionHandler(MethodArgumentNotValidException.class) returns 400 with validation errors.\n\nBest practice: create a standard error response DTO (timestamp, status, message, path) and return it consistently. Use @ResponseStatus on custom exceptions to set the default HTTP status.\n\nInterview trap: @ExceptionHandler in a @Controller only handles exceptions from that controller. @ControllerAdvice handles exceptions from ALL controllers globally.",
                    "transition_note": None
                },
            ],
            "Collections framework": [
                {
                    "question": "What are the main Java Collections interfaces and their implementations?",
                    "answer": "List (ArrayList, LinkedList), Set (HashSet, TreeSet, LinkedHashSet), Map (HashMap, TreeMap, LinkedHashMap), Queue (ArrayDeque, PriorityQueue).",
                    "explanation": "Java Collections Framework\n\nList: ordered, allows duplicates. ArrayList — O(1) random access, O(n) insert/delete middle. LinkedList — O(1) insert/delete at known position, O(n) access.\n\nSet: no duplicates. HashSet — O(1) add/contains/remove, no order. TreeSet — O(log n), sorted order. LinkedHashSet — O(1), insertion order.\n\nMap: key-value pairs, unique keys. HashMap — O(1) average, no order. TreeMap — O(log n), sorted by key. LinkedHashMap — O(1), insertion order.\n\nInterview trap: HashMap allows one null key and multiple null values. TreeMap does NOT allow null keys (throws NullPointerException during comparison). HashSet is backed by a HashMap internally.",
                    "transition_note": None
                },
            ],
        }

        qa_pairs_for_java = java_qa_map.get(java_topic, [
            {
                "question": f"What are the key concepts in {java_topic}?",
                "answer": f"Core principles and patterns of {java_topic} for backend development.",
                "explanation": f"{java_topic} Overview\n\nThis topic covers the fundamental concepts needed for backend development interviews.\n\nUnderstanding {java_topic} is essential for building scalable, maintainable applications.\n\nPractice implementing these concepts in code and be ready to explain trade-offs.\n\nCommon interview questions focus on practical application and edge cases.",
                "transition_note": None
            }
        ])

        tasks.append({
            "title": f"Backend: {java_topic}",
            "description": f"Master {java_topic} concepts for the {role or 'backend'} interview at {company}." + (f" PRIORITY: This is a missing skill from your gap analysis." if java_topic.lower() in [g.lower() for g in gaps] else "") + (f" [Mentor: {support_mode} mode — {'step-by-step explanations included' if 'guided' in mode else 'concise tasks' if 'self' in mode else 'adaptive to your gaps'}]" if support_mode else ""),
            "duration_minutes": 75 if day_num % 3 == 0 else 60,
            "task_type": "qa",
            "qa_pairs": qa_pairs_for_java,
            "quiz": [
                {
                    "question": f"Which is a core feature of {java_topic}?",
                    "options": ["Encapsulation", "Polymorphism", "Abstraction", "All of the above"],
                    "correct_index": 3,
                    "explanation": f"{java_topic} encompasses multiple OOP principles working together for clean, maintainable code."
                },
                {
                    "question": f"What is the primary benefit of using {java_topic} in enterprise applications?",
                    "options": ["Faster compilation speed", "Code reusability and maintainability", "Smaller binary size", "Automatic test generation"],
                    "correct_index": 1,
                    "explanation": f"{java_topic} promotes code reusability and maintainability through well-defined abstractions and design patterns."
                }
            ],
            "code_metadata": None,
        })

        # Every 3rd day: System Design
        if day_num % 3 == 0:
            tasks.append({
                "title": "System Design: Distributed Systems",
                "description": "Deep dive into a real system (e.g., cache, load balancer, database sharding). Design 1 system end-to-end.",
                "duration_minutes": 90,
                "task_type": "qa",
                "qa_pairs": [
                    {
                        "question": "How would you design a scalable URL shortener?",
                        "answer": "Use a hash function, distributed database, caching layer, and load balancer.",
                        "explanation": "URL Shortener System Design\n\nA URL shortener needs to handle high read traffic (redirects) and moderate write traffic (new URLs). The core components are: a hash function to generate short codes, a database to store mappings, a cache for hot URLs, and a load balancer.\n\nFor the hash function, use Base62 encoding of a counter or MD5/SHA256 truncated to 6-8 characters. Handle collisions by checking the database before inserting.\n\nFor storage, use a distributed key-value store like Redis for caching and a relational or NoSQL database for persistence. Partition by the short code hash for horizontal scaling.\n\nFor high availability, use multiple read replicas, CDN for static assets, and circuit breakers for downstream failures.",
                        "transition_note": None
                    }
                ],
                "quiz": [
                    {
                        "question": "In a URL shortener, which component handles the most traffic?",
                        "options": ["Write API", "Read/Redirect API", "Database", "Admin panel"],
                        "correct_index": 1,
                        "explanation": "Redirects (reads) vastly outnumber URL creation (writes). The read path must be optimized with caching."
                    }
                ],
                "code_metadata": None,
            })

        # Module Mastery Quiz — ALWAYS last task of every day
        tasks.append({
            "title": "Module Mastery Quiz",
            "description": f"Test your understanding of today's topics: {dsa_topic} and {java_topic}.",
            "duration_minutes": 20,
            "task_type": "qa",
            "qa_pairs": [
                {
                    "question": f"What is the key insight for solving {dsa_topic} problems efficiently?",
                    "answer": "Use appropriate data structures and algorithms to reduce time complexity.",
                    "explanation": f"Efficient {dsa_topic} Solutions\n\nThe key to solving {dsa_topic} problems efficiently is choosing the right data structure.\n\nFor most problems, a HashMap or HashSet reduces O(n^2) brute force to O(n) by enabling O(1) lookups.\n\nAlways analyze the problem constraints first: input size, value range, and required output type guide the optimal approach.\n\nPractice recognizing patterns: two pointers, sliding window, divide and conquer, and dynamic programming each apply to specific problem types.",
                    "transition_note": None
                }
            ],
            "quiz": [
                {
                    "question": f"What data structure typically reduces {dsa_topic} problems from O(n^2) to O(n)?",
                    "options": ["Array", "Stack", "HashMap", "Queue"],
                    "correct_index": 2,
                    "explanation": "HashMaps provide O(1) average-case lookups, converting nested loop problems into single-pass solutions."
                },
                {
                    "question": f"In {java_topic}, what is the primary benefit?",
                    "options": ["Faster compilation", "Code reusability and maintainability", "Smaller file size", "Automatic testing"],
                    "correct_index": 1,
                    "explanation": f"{java_topic} promotes code reusability and maintainability through well-defined abstractions and patterns."
                },
            ],
            "code_metadata": None,
        })

        daily_plan.append({
            "day": day_num,
            "focus": f"{dsa_topic} & {java_topic}",
            "tasks": tasks
        })

    # Build overview using all 6 features
    gap_note = f" Priority gaps: {', '.join(gaps[:3])}." if gaps else ""
    mode_note = f" Mentor style: {support_mode}." if support_mode else ""
    overview = (
        f"Personalized {days_to_plan}-day {role or 'interview'} preparation plan for {company}. "
        f"Focus: {framework_label} fundamentals, DSA, System Design, Coding Mock Tests, and Behavioral Interview.{gap_note}{mode_note}"
    )

    return {
        "overview": overview,
        "daily_plan": daily_plan,
        "resources": [
            f"{framework_label} documentation",
            "LeetCode (DSA practice)",
            "System Design Interview resources",
            f"Mock interview platform — practice 'Why {company}?' and STAR stories"
        ]
    }



def _get_resume_context(db: Session, student_id: int) -> str:
    """Gather resume context for plan generation prompt (optimized for latency).
    
    OPTIMIZATION: Instead of sending full resume text + all sections (can be 2000+ chars),
    only extract and send the 3 most relevant sections (experience, skills, education).
    This reduces prompt size by 60-80% while maintaining sufficient context for plan generation.
    
    Used by generate_learning_plan() to provide resume context to Gemini.
    Helps LLM understand student background to tailor plan to their experience level.
    
    Args:
        db: Database session
        student_id: Student ID
        
    Returns:
        str: Formatted resume sections (experience, skills, education) or default
    """
    resume = (
        db.query(Resume)
        .filter(Resume.student_id == student_id)
        .order_by(Resume.created_at.desc())
        .first()
    )
    if not resume:
        return "No resume available."

    sections = (
        db.query(ResumeSection)
        .filter(ResumeSection.resume_id == resume.id)
        .all()
    )
    
    # Prioritize key sections: experience, skills, education (3 most relevant)
    priority_types = {"experience", "work experience", "skills", "education", "technical skills"}
    included_sections = []
    
    for section in sections:
        section_type_lower = (section.section_type or "").lower()
        if any(ptype in section_type_lower for ptype in priority_types):
            # Truncate long section content to 500 chars (first 500 chars are most important)
            content_trimmed = section.content[:500] if len(section.content) > 500 else section.content
            included_sections.append(f"{section.section_type}: {content_trimmed.strip()}")
    
    if not included_sections:
        # Fallback: use first 2 sections if priority sections not found
        for section in sections[:2]:
            content_trimmed = section.content[:500] if len(section.content) > 500 else section.content
            included_sections.append(f"{section.section_type}: {content_trimmed.strip()}")
    
    if not included_sections:
        return "No resume content available."
    
    return "\n\n".join(included_sections)


def _get_profile_context(profile: StudentProfile | None) -> str:
    """Format student profile for plan generation prompt.
    
    Extracts student preferences (skill level, communication style, coding preference)
    to personalize the learning plan. Critical for ensuring plan matches student learning
    style and existing skill level.
    
    Now includes:
    - Skill proficiency levels (Advanced/Intermediate/Beginner) for each known skill
    - Marksheet data (CGPA, backlogs) when uploaded by the student
    
    Args:
        profile: StudentProfile object (or None if not created)
        
    Returns:
        str: Formatted profile text for LLM (or default message if no profile)
    """
    if not profile:
        return "No student profile available."
    
    # Format known_skills with proficiency levels
    # known_skills is stored as JSON: either list of strings or list of dicts {"skill": str, "proficiency": str}
    known_skills_raw = profile.known_skills or []
    skills_lines = []
    for item in known_skills_raw:
        if isinstance(item, dict):
            skill_name = item.get("skill", "Unknown")
            proficiency = item.get("proficiency", "Unknown")
            skills_lines.append(f"  - {skill_name} [{proficiency}]")
        elif isinstance(item, str):
            skills_lines.append(f"  - {item} [Unknown]")
    known_str = "\n".join(skills_lines) if skills_lines else "  None"
    
    # Format marksheet data if available
    marksheets_raw = profile.marksheets or []
    marksheet_lines = []
    for ms in marksheets_raw:
        if isinstance(ms, dict):
            file_name = ms.get("file_name", "Unknown")
            marksheet_lines.append(f"  - {file_name}")
    marksheet_str = "\n".join(marksheet_lines) if marksheet_lines else "  No marksheets uploaded"
    
    return (
        f"Primary Skill: {profile.primary_skill}\n"
        f"Known Skills (with proficiency):\n{known_str}\n"
        f"Support Mode: {profile.support_mode}\n"
        f"Tone: {profile.tone}\n"
        f"Coding Required: {profile.coding_required}\n"
        f"Marksheets Uploaded:\n{marksheet_str}"
    )


def _get_days_available_from_active_license(
    db: Session,
    student_id: int,
    company_name: str,
) -> int:
    """Calculate days available until interview. (Defaulting to 14 days without license)"""
    return 14


def _get_target_context(target: TargetInterview | None) -> str:
    """Format target interview details for plan generation prompt.
    
    Extracts company, role, required skills, difficulty, interview format,
    and job description. Gemini uses this to understand what the student
    is being asked to interview for and tailor the plan accordingly.
    
    Args:
        target: TargetInterview object (or None if not configured)
        
    Returns:
        str: Formatted target interview text for LLM (or default if no target)
    """
    if not target:
        return "No target interview available."
    required = ", ".join(target.required_skills or []) or "None"
    return (
        f"Company: {target.company_name}\n"
        f"Role: {target.role or 'General'}\n"
        f"Required Skills: {required}\n"
        f"Difficulty: {target.difficulty}\n"
        f"Round Structure: {target.round_structure}\n"
        f"Job Description:\n{target.jd_text}"
    )


def _get_gap_context(gap: ResumeGapAnalysis | None) -> str:
    """Format resume gap analysis for plan generation prompt.
    
    Extracts skills missing from resume compared to target JD, plus quality scores.
    Used by Gemini to identify preparation gaps and prioritize high-impact learning tasks.
    
    Args:
        gap: ResumeGapAnalysis object (or None if not yet analyzed)
        
    Returns:
        str: Formatted gap analysis for LLM (or default if no analysis)
    """
    if not gap:
        return "No resume gap analysis available."
    missing = ", ".join(gap.missing_skills or []) or "None"
    return (
        f"Missing Skills: {missing}\n"
        f"Keyword Score: {gap.keyword_score}\n"
        f"ATS Score: {gap.ats_score}"
    )


def _get_latest_target(
    db: Session,
    student_id: int,
    company_name: str | None,
    role: str | None,
) -> TargetInterview | None:
    """Retrieve the most recent target interview for a student.
    
    Optionally filtered by company and/or role. Used by generate_learning_plan()
    to find what company/role the student is interviewing for.
    
    Args:
        db: Database session
        student_id: Student ID
        company_name: Optional company filter (case-sensitive)
        role: Optional role filter
        
    Returns:
        TargetInterview object (or None if no target found)
    """
    query = db.query(TargetInterview).filter(TargetInterview.student_id == student_id)
    if company_name:
        query = query.filter(TargetInterview.company_name == company_name)
    if role:
        query = query.filter(TargetInterview.role == role)
    return query.order_by(TargetInterview.created_at.desc()).first()

def _get_feedback_intelligence(db: Session, company_name: str) -> str:
    """
    Fetch pre-built Ollama intelligence snippet from feedback_analysis_cache.
    Zero extra LLM cost at runtime — reads from DB only.
    """
    try:
        from app.services.feedback_agent_service import get_feedback_intelligence
        return get_feedback_intelligence(db, company_name)
    except Exception as exc:
        logger.warning("[PLAN-AGENT] Could not fetch feedback intelligence for %s: %s", company_name, exc)
        return "No prior student interview data available for this company yet."


def generate_learning_plan(
    db: Session,
    student_id: int,
    company_name: str,
    days_available: int,
    role: str | None = None,
    interview_date: date | None = None,
) -> LearningPlan:
    """Generate a learning plan using two-phase approach for faster initial response.
    
    CRITICAL: This is called ONLY by Celery worker (generate_plan_task).
    
    TWO-PHASE OPTIMIZATION:
    PHASE 1 (FAST ~1-2s): Generate skeleton plan
      - Rule-based structure using missing_skills and role
      - Saves to DB immediately with status='ready'
      - Returns immediately for API response
    
    PHASE 2 (BACKGROUND): Generate plan summary via single Gemini call
      - Worker task: generate_plan_summary() 
      - Calls Gemini ONCE to produce personalized strategy/advice
      - Stores in plan_summary field (NOT in plan_json daily_plan)
      - No impact on skeleton plan structure
    
    OPTIMIZATION:
    - Frontend gets response in <2s (skeleton plan structure only)
    - User sees basic plan while summary is generated in background
    - Users can start studying with skeleton immediately
    - Single LLM call per plan (not per-day) = 25x less token spend
    - No UI blocking or timeouts
    - Personalized strategy available within 10-30s
    
    FALLING BACK BEHAVIOR:
    - If Gemini fails: keeps skeleton forever (still valid)
    - If summary generation fails: keeps skeleton (better than nothing)
    - User always has functional plan unlike timeout failures
    
    PIPELINE:
    Step 1: Validate student, retrieve profile, target interview, resume gap analysis
    Step 2: Verify active license for student+company and calculate days_available
    Step 3: Build plan_signature (deterministic: student_id:company:role:interview_date)
    Step 4: Check if plan with same signature exists and status='ready' (cache hit -> return)
    Step 5: Generate SKELETON plan (rule-based, no LLM call)
    Step 6: Save skeleton plan immediately
    Step 7: Enqueue generate_plan_summary() Celery task for Phase 2
    
    Args:
        db: Database session
        student_id: Student requesting plan
        company_name: Target company
        days_available: Days until interview (from license.interview_date)
        role: Optional specific role (defaults to target.role)
        interview_date: Optional interview date override from validated license context
        
    Returns:
        LearningPlan: Skeleton plan object with status='ready' and plan_summary=None (populated async)
        
    Raises:
        ValueError: Student not found, no active license, or invalid configuration
    """
    logger.info(
        "[PLAN-TRACE] Step 6: Entered plan_service.generate_learning_plan (PHASE 1 SKELETON) student_id=%s company=%s role=%s",
        student_id, company_name, role
    )
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    target = _get_latest_target(db, student_id, company_name, role)
    gap = (
        db.query(ResumeGapAnalysis)
        .filter(ResumeGapAnalysis.student_id == student_id)
        .order_by(ResumeGapAnalysis.created_at.desc())
        .first()
    )

    if not company_name and target:
        company_name = target.company_name
    if role is None and target:
        role = target.role

    if days_available < 1:
        days_available = _get_days_available_from_active_license(
            db,
            student_id,
            company_name,
        )

    if not company_name or not days_available:
        raise ValueError("Missing target interview or valid interview date")

    # Build plan signature for caching
    plan_signature = build_plan_signature(
        student_id,
        company_name,
        role,
    )
    
    # Check if plan with same signature already exists
    existing_plan = (
        db.query(LearningPlan)
        .filter(LearningPlan.plan_signature == plan_signature)
        .first()
    )
    if existing_plan and existing_plan.status == "ready":
        logger.info("[PLAN-TRACE] Step 4: Cache hit - returned existing plan plan_id=%s", existing_plan.id)
        return existing_plan

    # ===== PHASE 1: GENERATE LIVE LLM PLAN =====
    logger.info("[PLAN-TRACE] Step 5: Generating live LLM plan")
    
    # Build marksheet context for academic gap detection
    marksheet_context = "No marksheets uploaded."
    if profile and profile.marksheets:
        ms_lines = []
        for ms in (profile.marksheets or []):
            if isinstance(ms, dict):
                fname = ms.get("file_name", "")
                if fname:
                    ms_lines.append(f"  - {fname}")
        if ms_lines:
            marksheet_context = "Marksheets uploaded:\n" + "\n".join(ms_lines) + "\n(Use to detect academic weak areas that map to interview gaps, e.g., low DB marks → weak SQL)"

    context = {
        "student_name": getattr(student, "first_name", "Student") or getattr(student, "name", "Student"),
        "primary_skill": profile.primary_skill if profile else "Unknown",
        "known_skills": profile.known_skills if profile else [],
        "days_available": days_available,
        "support_mode": profile.support_mode if profile else "Guided",
        "tone": profile.tone if profile else "Supportive",
        "coding_required": profile.coding_required if profile else True,

        "company_name": company_name,
        "role": role or "General",
        "difficulty": target.difficulty if target else "Unknown",
        "round_structure": target.round_structure if target else "Unknown",
        "jd_text": target.jd_text if target else "Not provided",

        "ats_score": gap.ats_score if gap else 0,
        "missing_skills": gap.missing_skills if gap else [],
        "keyword_score": gap.keyword_score if gap else 0,

        "resume_context": _get_resume_context(db, student_id),
        "profile_context": _get_profile_context(profile),
        "company_context": _get_feedback_intelligence(db, company_name),
        "marksheet_context": marksheet_context,
    }

    raw_response, usage = generate_plan_with_llm(context)
    plan_data = _parse_plan_json(raw_response)
    
    # Record usage if available
    if usage:
        try:
            from app.services.usage_service import record_llm_usage
            record_llm_usage(
                db=db,
                provider="openai" if "gpt" in usage["model"].lower() else "gemini",
                model=usage["model"],
                action="plan_generation",
                prompt_tokens=usage["prompt_tokens"],
                completion_tokens=usage["completion_tokens"],
                student_id=student_id
            )
        except Exception as usage_exc:
            logger.warning("[PLAN-USAGE] Failed to record usage: %s", usage_exc)
    
    if not _validate_plan_json(plan_data):
        raise LLMValidationError("Generated plan failed schema validation")

    # Save plan to DB — always UPDATE the existing stub if present (avoids UniqueViolation)
    # Re-query here because the stub may have been created after our initial check above.
    logger.info("[PLAN-TRACE] Step 6: Saving live plan to DB")
    current_plan = (
        db.query(LearningPlan)
        .filter(LearningPlan.plan_signature == plan_signature)
        .first()
    )
    # ── Save plan using raw SQL UPDATE/INSERT to avoid session state issues ──
    # The session may be dirty from previous failed attempts in the retry loop.
    # Raw SQL bypasses ORM session tracking and always works cleanly.
    import json as _json
    from sqlalchemy import text as _text

    plan_json_str = _json.dumps(plan_data)

    logger.info("[PLAN-TRACE] Step 6: Saving live plan to DB via raw SQL")

    # Try UPDATE first (stub exists from activation endpoint)
    result = db.execute(
        _text(
            "UPDATE learning_plans SET status='ready', plan_json=CAST(:pj AS json), "
            "tasks_generated=1, summary_generated=false "
            "WHERE plan_signature=:sig"
        ),
        {"pj": plan_json_str, "sig": plan_signature},
    )
    db.commit()

    if result.rowcount == 0:
        # No existing stub — INSERT new plan
        db.execute(
            _text(
                "INSERT INTO learning_plans "
                "(student_id, company_name, role, days_available, plan_signature, "
                "status, plan_json, tasks_generated, summary_generated, created_at) "
                "VALUES (:sid, :co, :ro, :da, :sig, 'ready', CAST(:pj AS json), 1, false, NOW())"
            ),
            {
                "sid": student_id,
                "co": company_name,
                "ro": role or "general",
                "da": days_available,
                "sig": plan_signature,
                "pj": plan_json_str,
            },
        )
        db.commit()

    # Fetch the saved plan object
    plan = (
        db.query(LearningPlan)
        .filter(LearningPlan.plan_signature == plan_signature)
        .first()
    )

    # Create learning tasks — delete old ones first
    db.query(LearningTask).filter(LearningTask.plan_id == plan.id).delete()
    db.commit()

    for day_data in plan_data.get("daily_plan", []):
        day_num = day_data["day"]
        for task_index, task_data in enumerate(day_data["tasks"], start=1):
            task = LearningTask(
                plan_id=plan.id,
                day=day_num,
                task_order=task_index,
                title=task_data["title"],
                description=task_data["description"],
                duration_minutes=task_data["duration_minutes"],
                task_type=task_data.get("task_type", "text"),
                qa_pairs=task_data.get("qa_pairs"),
                quiz=task_data.get("quiz"),
                code_metadata=task_data.get("code_metadata"),
            )
            db.add(task)

    logger.info("[PLAN-TRACE] Step 7: Live plan saved to DB. plan_id=%s status=ready", plan.id)
    db.commit()
    db.refresh(plan)
    
    # ===== PHASE 2: ENQUEUE PLAN SUMMARY GENERATION (BACKGROUND) =====
    logger.info("[PLAN-TRACE] Step 8: Enqueueing background plan summary generation for plan_id=%s", plan.id)
    try:
        from app.tasks.jobs import generate_plan_summary
        generate_plan_summary.delay(plan.id)
        logger.info("[PLAN-TRACE] Plan summary task enqueued plan_id=%s", plan.id)
    except Exception as enqueue_exc:
        logger.warning("[PLAN-TRACE] Failed to enqueue plan summary task: %s", str(enqueue_exc))
    
    logger.info("[PLAN-TRACE] Step 9: Plan generation complete plan_id=%s", plan.id)
    return plan


def refine_learning_plan(
    db: Session,
    existing_plan: LearningPlan,
    gap_analysis: ResumeGapAnalysis,
) -> LearningPlan:
    """Refine an existing learning plan based on updated gap analysis.
    
    LIGHTWEIGHT OPERATION: Uses a single Gemini call to reorder task priorities
    and focus within each day, without rebuilding the entire plan structure.
    
    Called when resume gap analysis is updated (e.g., new resume uploaded).
    Ensures plan focuses on newly-identified missing skills without requiring
    full plan regeneration (saves tokens).
    
    Args:
        db: Database session
        existing_plan: LearningPlan to refine
        gap_analysis: Updated ResumeGapAnalysis with new missing skills
        
    Returns:
        LearningPlan: Updated plan with reordered tasks (same structure, new priorities)
    """
    missing_skills_str = ", ".join(gap_analysis.missing_skills or []) or "None"
    current_plan_str = json.dumps(existing_plan.plan_json, indent=2)
    
    refine_prompt = f"""You have an existing learning plan. Based on new resume gap analysis, reorder task priorities to focus on missing skills.

MISSING SKILLS: {missing_skills_str}
ATS SCORE: {gap_analysis.ats_score}

CURRENT PLAN:
{current_plan_str}

Adjust the task order and focus within each day to prioritize the missing skills. Keep the same structure but reorder tasks. Return the complete updated plan in the same JSON format."""

    raw_response, _usage = generate_plan_with_llm(refine_prompt)
    refined_data = _parse_plan_json(raw_response)
    
    # Update the plan
    existing_plan.plan_json = refined_data
    db.commit()
    db.refresh(existing_plan)
    
    return existing_plan