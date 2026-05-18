import asyncio
import json
from app.api.topic import _generate_topic_content

def run():
    try:
        content = _generate_topic_content(
            topic_id="java",
            topic_name="Java",
            sub_topics=[
                {"id": "java-memory-model", "title": "Java Memory Model"}
            ],
            difficulty="medium",
            mastery_time_minutes=60,
            target_role="Java Developer",
            company="Google",
            target_language="Java",
            interview_round_type="coding",
            coding_required=True,
            student_known_skills=[{"skill": "Java", "proficiency": "advanced"}]
        )
        print("SUCCESS!")
        print(json.dumps(content, indent=2))
    except Exception as e:
        print("FAILED!")
        print(e)

if __name__ == "__main__":
    run()
