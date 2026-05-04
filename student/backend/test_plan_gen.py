import os
import sys
import json
from dotenv import load_dotenv

# Setup paths
backend_dir = os.path.dirname(os.path.abspath(__file__))
shared_dir = os.path.abspath(os.path.join(backend_dir, "../../"))
if shared_dir not in sys.path:
    sys.path.insert(0, shared_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.llm_client import generate_learning_plan

# Dummy Context
context = {
    "student_name": "Test User",
    "primary_skill": "JavaScript",
    "known_skills": [
        {"skill": "JavaScript", "proficiency": "Advanced"},
        {"skill": "React", "proficiency": "Intermediate"}
    ],
    "days_available": 5,
    "support_mode": "Guided coaching",
    "tone": "Direct",
    "coding_required": True,
    "company_name": "Google",
    "role": "Frontend Engineer",
    "difficulty": "Hard",
    "round_structure": "Technical Screen, Onsite (Algorithms, System Design, Behavioral)",
    "jd_text": "Looking for a Frontend Engineer with strong JavaScript and React skills. Experience with System Design is a plus.",
    "ats_score": 80,
    "missing_skills": ["System Design"],
    "keyword_score": 75,
    "resume_context": "Worked as a Frontend Developer for 3 years using React.",
    "profile_context": "Goal: Pass Google interview.",
    "company_context": "Google interviews focus heavily on algorithms and system design."
}

print("Testing Plan Generation with the new System Prompt...\n")
try:
    plan = generate_learning_plan(context)
    print("SUCCESS: Plan Generated!\n")
    print("Plan Output:")
    print(json.dumps(plan, indent=2))
except Exception as e:
    print(f"FAILED: Error generating plan: {e}")
