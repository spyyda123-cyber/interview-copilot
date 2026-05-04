import pytest
import os
import sys

# Setup path so tests can run easily
backend_dir = os.path.dirname(os.path.abspath(__file__))
shared_dir = os.path.abspath(os.path.join(backend_dir, "../../"))
if shared_dir not in sys.path:
    sys.path.insert(0, shared_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.llm_client import build_learning_plan_prompt
from app.services.openai_client import _build_user_message

def test_openai_prompt_truncation_business_flow():
    """
    Business Flow: Test that massive resume data is truncated correctly 
    so it does not cause an OpenAI token limit failure.
    """
    massive_resume = "Experience: " + ("Developer " * 500)  # > 4000 chars
    
    mock_context = {
        "student_name": "Test User",
        "primary_skill": "JavaScript",
        "resume_context": massive_resume,
        "company_context": "Targeting Google",
    }
    
    # Run the prompt builder
    generated_prompt = _build_user_message(mock_context)
    
    # Validation
    assert "Test User" in generated_prompt, "Student name should be in the prompt"
    assert "JavaScript" in generated_prompt, "Primary skill should be in the prompt"
    
    # Technical Flow: The resume block should be truncated to 1500 chars 
    # to protect token complexity!
    assert len(generated_prompt) < 4000, "The generated prompt is too large! Truncation failed."

def test_language_transition_logic():
    """
    Technical Flow: Test the cross-language transition logic (Section 9).
    If a user is Advanced in Python but the JD requires Java, it should trigger the transition text.
    """
    mock_context = {
        "student_name": "Alice",
        "primary_skill": "Python",
        "known_skills": [
            {"skill": "Python", "proficiency": "Advanced"}
        ],
        "missing_skills": ["Java", "System Design"],
    }
    
    # Run the prompt builder
    generated_prompt = _build_user_message(mock_context)
    
    # Validation
    assert "LANGUAGE TRANSITION CONTEXT" in generated_prompt, "Language transition block missing"
    assert "Python → java" in generated_prompt or "python → java" in generated_prompt.lower(), "Transition mapping missing"

def test_gemini_prompt_fallback_data():
    """
    Business Flow: Ensure the Gemini prompt builder passes the exact same truncated data.
    """
    mock_context = {
        "student_name": "Bob",
        "days_available": 3,
        "missing_skills": ["React"],
    }
    
    generated_prompt = build_learning_plan_prompt(mock_context)
    
    assert "Days Remaining: 3" in generated_prompt
    assert "React" in generated_prompt

from app.services.openai_client import _create_fallback_plan, JD_ANALYSIS_SCHEMA

def test_fallback_plan_generation():
    """
    Business Flow: Test the hardcoded fallback plan mechanism.
    If the LLM fails completely, it should return a valid 5-day plan schema.
    """
    mock_context = {
        "days_available": 5,
        "company_name": "Netflix",
        "role": "Backend Engineer",
    }
    
    fallback_plan = _create_fallback_plan(mock_context)
    
    # Validation
    assert "overview" in fallback_plan
    assert "daily_plan" in fallback_plan
    assert "resources" in fallback_plan
    assert len(fallback_plan["daily_plan"]) == 5, "Fallback should strictly generate a 5-day plan based on days_available"
    assert "Netflix" in fallback_plan["overview"], "Company name missing in fallback overview"

def test_jd_schema_structure():
    """
    Technical Flow: Verify the JSON schema enforced on the OpenAI call for JD analysis.
    """
    assert "required_skills" in JD_ANALYSIS_SCHEMA["schema"]["properties"]
    assert JD_ANALYSIS_SCHEMA["strict"] is True, "Structured output strictness must be True for guaranteed JSON"
    assert "difficulty" in JD_ANALYSIS_SCHEMA["schema"]["required"]
    assert "difficulty" in JD_ANALYSIS_SCHEMA["schema"]["required"]

# ==============================================================================
# SPECIFIC USER SCENARIOS (LANGUAGE & SKILL TRANSITIONS)
# ==============================================================================

def test_scenario_python_to_java():
    """Guhan as python developer applying for java developer role."""
    mock_context = {
        "student_name": "Guhan",
        "primary_skill": "Python",
        "known_skills": [{"skill": "Python", "proficiency": "Advanced"}],
        "missing_skills": ["Java"],
        "role": "Java Developer"
    }
    prompt = _build_user_message(mock_context)
    assert "LANGUAGE TRANSITION CONTEXT" in prompt
    assert "Python → java" in prompt.lower() or "python → java" in prompt.lower()

def test_scenario_java_to_java():
    """Ashika as Java developer applying for Java developer role."""
    mock_context = {
        "student_name": "Ashika",
        "primary_skill": "Java",
        "known_skills": [{"skill": "Java", "proficiency": "Advanced"}],
        "missing_skills": [],  # No missing language
        "role": "Java Developer"
    }
    prompt = _build_user_message(mock_context)
    # Should say no language transition needed or skip Section 9
    assert "No language transition detected" in prompt or "No language transition needed" in prompt

def test_scenario_java_to_python():
    """Guhan as Java developer applying for Python developer role."""
    mock_context = {
        "student_name": "Guhan",
        "primary_skill": "Java",
        "known_skills": [{"skill": "Java", "proficiency": "Advanced"}],
        "missing_skills": ["Python"],
        "role": "Python Developer"
    }
    prompt = _build_user_message(mock_context)
    assert "LANGUAGE TRANSITION CONTEXT" in prompt
    assert "java → python" in prompt.lower()

def test_scenario_python_to_python():
    """Guhan as Python developer applying for Python developer role."""
    mock_context = {
        "student_name": "Guhan",
        "primary_skill": "Python",
        "known_skills": [{"skill": "Python", "proficiency": "Advanced"}],
        "missing_skills": [],
        "role": "Python Developer"
    }
    prompt = _build_user_message(mock_context)
    assert "No language transition detected" in prompt or "No language transition needed" in prompt

def test_scenario_frontend_to_backend():
    """Guhan as Frontend developer applying for Backend developer role."""
    # This shouldn't trigger a programming language analogy unless specific languages are missing.
    # We test that it safely processes this broad transition without crashing.
    mock_context = {
        "student_name": "Guhan",
        "primary_skill": "Frontend Developer",
        "known_skills": [{"skill": "React", "proficiency": "Advanced"}, {"skill": "JavaScript", "proficiency": "Advanced"}],
        "missing_skills": ["Backend Architecture", "Node.js"],
        "role": "Backend Developer"
    }
    prompt = _build_user_message(mock_context)
    # Since "JavaScript" is known but no new language from _PROG_LANGUAGES is in missing_skills (Node.js is an env, maybe not in _PROG_LANGUAGES),
    # it shouldn't trigger an analogy, OR if Node is mapped it might. 
    # The main check is that it handles the gap analysis properly.
    assert "Frontend Developer" in prompt
    assert "Backend Developer" in prompt
    assert "Backend Architecture" in prompt

def test_scenario_backend_to_backend():
    """Guhan as Backend developer applying for Backend developer role."""
    mock_context = {
        "student_name": "Guhan",
        "primary_skill": "Backend Developer",
        "known_skills": [{"skill": "Node.js", "proficiency": "Advanced"}],
        "missing_skills": ["Docker"],
        "role": "Backend Developer"
    }
    prompt = _build_user_message(mock_context)
    assert "Backend Developer" in prompt
    assert "Docker" in prompt
    assert "LANGUAGE TRANSITION CONTEXT" not in prompt

if __name__ == "__main__":
    pytest.main(["-v", __file__])
