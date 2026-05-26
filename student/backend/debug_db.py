import os
import sys
import json
sys.path.insert(0, os.path.abspath(os.path.join('.', '..', '..')))
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
        if 'practice_tasks' in content:
            tasks = content['practice_tasks']
            for t in tasks:
                print(f"Task ID: {t.get('id')}, Type: {t.get('task_type')}, Title: {t.get('title')}")
                if t.get('task_type') == 'code':
                    print(f"Problem statement: {t.get('problem_statement')}")
                    print(f"Test cases: {len(t.get('test_cases', [])) if t.get('test_cases') else 0}")
                    print(t.get('test_cases'))
        else:
            print("No practice tasks")
    except Exception as e:
        print("FAILED!")
        print(e)

if __name__ == "__main__":
    run()
