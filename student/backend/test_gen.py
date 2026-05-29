import sys
import json
import asyncio
sys.path.append('.')
from app.services.llm_client import generate_learning_plan

test_context = {
    "student_profile": {
        "name": "testuser",
        "primary_skill": "Python",
        "skills": [{"skill": "Python", "proficiency": "Advanced"}],
        "coding_required": True,
        "days_left": 14
    },
    "resume": "Experience as a software engineer.",
    "target_interview": {
        "company": "Amazon",
        "role": "Java Developer",
        "JD": "Seeking a strong Java backend developer.",
        "required_skills": ["Java", "Spring Boot", "OOP"],
        "difficulty": "medium",
        "round_structure": ["coding", "system_design"]
    },
    "resume_gap_analysis": {
        "missing_skills": ["Java", "Spring Boot"],
        "ATS_score": 50,
        "keyword_match_score": 40
    }
}

async def test():
    res, usage = generate_learning_plan(test_context)
    if isinstance(res, str):
        res = json.loads(res)
    foundations = res.get("curriculum", [])[0].get("topics", []) if res.get("curriculum") else []
    print("FOUNDATION TOPICS COUNT:", len(foundations))
    for t in foundations:
        print(" -", t.get("title"))

if __name__ == "__main__":
    asyncio.run(test())
