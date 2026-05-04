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
        
        # Rotate through topics for each day
        topic_idx = (day_num - 1) % len(all_topics)
        current_topic = all_topics[topic_idx]
        
        # First task: focused topic (30-60 min)
        tasks.append({
            "title": f"{current_topic} - Deep Dive",
            "description": f"Study core {current_topic} concepts and create short revision notes for quick recall.",
            "duration_minutes": 45,
        })
        
        # Second task: Practice/Problems (60-90 min)
        if day_num % 3 != 0:
            tasks.append({
                "title": f"Practice: {current_topic} Problems",
                "description": f"Solve timed practice problems on {current_topic} and review mistakes immediately.",
                "duration_minutes": 60,
            })
        else:
            # Every 3rd day: System design / Architecture focus
            tasks.append({
                "title": "System Design Practice",
                "description": "Design a scalable solution, discuss trade-offs, and justify architecture decisions.",
                "duration_minutes": 90,
            })
        
        # Third task: Review/Mock (varies by day)
        if day_num % 5 == 0:
            # Every 5th day: Mock interview
            tasks.append({
                "title": "Mock Interview Simulation",
                "description": "Run a full mock interview (coding + explanation + behavioral answers) and capture feedback.",
                "duration_minutes": 120,
            })
        elif day_num == days_to_plan:
            # Last day: Final revision
            tasks.append({
                "title": "Final Revision & Mental Prep",
                "description": "Review top concepts, rehearse key stories, and prepare a calm interview-day checklist.",
                "duration_minutes": 90,
            })
        else:
            tasks.append({
                "title": "Review & Explain",
                "description": f"Explain {current_topic} out loud as if teaching someone and fill any understanding gaps.",
                "duration_minutes": 45,
            })
        
        daily_plan.append({
            "day": day_num,
            "focus": current_topic,
            "tasks": tasks,
        })
    
    return {
        "overview": f"Preparing for {company_name} {role or 'General'} interview ({difficulty or 'unknown'} difficulty)",
        "daily_plan": daily_plan,
        "resources": [
            "Use your resume project stories for behavioral and technical explanations.",
            "Practice at least one timed coding problem daily and review the solution quality.",
            "Track weak topics in a short checklist and revisit them every 2-3 days.",
        ],
        "_skeleton": True,  # Flag to indicate this is skeleton version
    }


def _generate_fallback_plan(days_available: int) -> dict:
    """Generate deterministic fallback plan without LLM.
    
    CRITICAL RELIABILITY: When Gemini fails after retries, generate rule-based plan.
    User ALWAYS receives a functional plan (either real or fallback).
    
    RULES:
    - Daily DSA practice (30-60 min)
    - Java + Spring topics rotating (60-90 min)
    - Every 3rd day: System Design deep dive (90 min)
    - Every 5th day: Mock interview simulation (120 min)
    - Last day: Revision + final mock interview (180 min)
    
    Args:
        days_available: Number of days until interview (1-365)
        
    Returns:
        dict: Valid plan JSON matching normal Gemini response format
    """
    daily_plan = []
    days_to_plan = min(days_available, 100)  # Cap at 100 days
    
    dsa_tasks = [
        "Array & String manipulation", "Linked Lists", "Trees & Graphs",
        "Dynamic Programming", "Sorting & Searching", "Hash Maps",
        "Stacks & Queues", "Recursion & Backtracking"
    ]
    
    java_spring_tasks = [
        "Java fundamentals & OOP", "Spring Boot basics", "Spring MVC",
        "Spring Data JPA", "Spring Security", "RESTful APIs",
        "Exception handling", "Collections framework"
    ]
    
    for day_num in range(1, days_to_plan + 1):
        tasks = []
        
        # Daily DSA practice (rotating through topics)
        dsa_topic = dsa_tasks[(day_num - 1) % len(dsa_tasks)]
        tasks.append({
            "title": f"DSA: {dsa_topic}",
            "description": f"Practice {dsa_topic} problems. Solve 2-3 progressively harder problems.",
            "duration_minutes": 60 if day_num % 2 == 0 else 45
        })
        
        # Java/Spring topics (rotate daily)
        java_topic = java_spring_tasks[(day_num - 1) % len(java_spring_tasks)]
        tasks.append({
            "title": f"Backend: {java_topic}",
            "description": f"Study {java_topic}. Review concepts and work through code examples.",
            "duration_minutes": 75 if day_num % 3 == 0 else 60
        })
        
        # Every 3rd day: System Design
        if day_num % 3 == 0:
            tasks.append({
                "title": "System Design: Distributed Systems",
                "description": "Deep dive into a real system (e.g., cache, load balancer, database sharding). Design 1 system end-to-end.",
                "duration_minutes": 90
            })
        
        # Every 5th day: Mock interview
        if day_num % 5 == 0:
            tasks.append({
                "title": "Mock Interview Simulation",
                "description": "Simulate a full technical interview. Code on whiteboard/IDE, explain approaches, handle follow-ups.",
                "duration_minutes": 120
            })
        
        # Last day: Final revision + mock
        if day_num == days_to_plan:
            tasks = [
                {
                    "title": "Comprehensive Revision",
                    "description": "Review key topics from all days. Refresh memory on DSA patterns and Spring concepts.",
                    "duration_minutes": 120
                },
                {
                    "title": "Final Mock Interview",
                    "description": "Full end-to-end mock interview with all interview rounds. Record yourself for feedback.",
                    "duration_minutes": 180
                }
            ]
        
        daily_plan.append({
            "day": day_num,
            "focus": f"Day {day_num}/{days_to_plan}",
            "tasks": tasks
        })
    
    return {
        "overview": f"Fallback {days_to_plan}-day Java/Spring interview preparation plan. Focus: DSA + Backend + System Design + Mock interviews.",
        "daily_plan": daily_plan,
        "resources": [
            "LeetCode (DSA practice)",
            "Spring Boot documentation",
            "System Design Interview resources",
            "Mock interview platform"
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
        "company_context": _get_feedback_intelligence(db, company_name)
    }

    raw_response = generate_plan_with_llm(context)
    plan_data = _parse_plan_json(raw_response)
    
    if not _validate_plan_json(plan_data):
        raise LLMValidationError("Generated plan failed schema validation")
    
    # Save plan to DB immediately
    logger.info("[PLAN-TRACE] Step 6: Saving live plan to DB")
    if existing_plan:
        plan = existing_plan
        plan.student_id = student_id
        plan.company_name = company_name
        plan.role = role or "general"
        plan.days_available = days_available
        plan.status = "ready"
        plan.plan_json = plan_data
        plan.tasks_generated = 1  # Enriched
        plan.summary_generated = False
        try:
            plan.plan_type = "ai"
        except Exception:
            pass
    else:
        plan = LearningPlan(
            student_id=student_id,
            company_name=company_name,
            role=role or "general",
            days_available=days_available,
            plan_signature=plan_signature,
            status="ready",
            plan_json=plan_data,
            tasks_generated=1,
            summary_generated=False,
        )
        try:
            plan.plan_type = "ai"
        except Exception:
            pass
        db.add(plan)
        db.flush()

    # Create learning tasks
    if existing_plan:
        db.query(LearningTask).filter(LearningTask.plan_id == plan.id).delete()

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

    refined_data = _parse_plan_json(generate_plan_with_llm(refine_prompt))
    
    # Update the plan
    existing_plan.plan_json = refined_data
    db.commit()
    db.refresh(existing_plan)
    
    return existing_plan