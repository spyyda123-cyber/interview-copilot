"""
Curated technical skills dictionary for deterministic skill extraction.

This replaces frequency-based token extraction with explicit skill matching.
"""

# Core technical skills - curated list
TECHNICAL_SKILLS = [
    "Java",
    "Core Java",
    "Spring",
    "Spring Boot",
    "Spring MVC",
    "Hibernate",
    "JPA",
    "REST",
    "REST API",
    "Microservices",
    "SQL",
    "MySQL",
    "PostgreSQL",
    "Docker",
    "Kubernetes",
    "Git",
    "Maven",
    "Gradle",
    "Linux",
    "Jenkins",
    "AWS",
    "OOP",
    "Multithreading",
    "Collections",
    "System Design",
    "Design Patterns",
    "Angular",
    "JavaScript",
    "HTML",
    "CSS",
]

# Synonym mapping for normalization
SKILL_SYNONYMS = {
    "restful": "REST API",
    "springboot": "Spring Boot",
    "mysql database": "MySQL",
    "object oriented programming": "OOP",
    "multi threading": "Multithreading",
}


def normalize_skill(skill: str) -> str:
    """
    Normalize a skill name to its canonical form.
    
    Args:
        skill: Raw skill name from JD or resume
        
    Returns:
        Normalized skill name
    """
    lowered = skill.strip().lower()
    # Remove extra spaces
    lowered = " ".join(lowered.split())
    
    # Check synonyms
    if lowered in SKILL_SYNONYMS:
        return SKILL_SYNONYMS[lowered]
    
    # Return original if not in synonyms
    return skill.strip()


def extract_skills_from_text(text: str) -> list[str]:
    """
    Extract technical skills from text using deterministic dictionary matching.
    
    This replaces random frequency-based extraction with explicit skill detection.
    
    Args:
        text: Job description or resume text
        
    Returns:
        List of matched technical skills (deduplicated and normalized)
    """
    if not text:
        return []
    
    lowered_text = text.lower()
    matched_skills = set()
    
    # Check each skill in our dictionary
    for skill in TECHNICAL_SKILLS:
        if skill.lower() in lowered_text:
            matched_skills.add(normalize_skill(skill))

    # Check synonyms explicitly
    for phrase, canonical in SKILL_SYNONYMS.items():
        if phrase in lowered_text:
            matched_skills.add(canonical)
    
    # Return sorted list for consistency
    return sorted(list(matched_skills))


def compare_skills(resume_skills: set[str], required_skills: list[str]) -> tuple[list[str], float]:
    """
    Compare resume skills against required skills with normalization.
    
    Args:
        resume_skills: Set of skills extracted from resume
        required_skills: List of skills required by job
        
    Returns:
        Tuple of (missing_skills, match_ratio)
    """
    # Normalize all skills for comparison (lowercase + remove spaces)
    def _compact(skill: str) -> str:
        return "".join(skill.lower().split())

    normalized_resume = {_compact(normalize_skill(s)) for s in resume_skills}
    normalized_required = [normalize_skill(s) for s in required_skills]
    
    # Find missing skills
    missing = []
    for required in normalized_required:
        required_lower = _compact(required)
        # Check exact match or substring match
        found = False
        for resume_skill in normalized_resume:
            if required_lower in resume_skill or resume_skill in required_lower:
                found = True
                break
        
        if not found:
            missing.append(required)
    
    # Calculate match ratio
    if not normalized_required:
        return [], 1.0
    
    matched_count = len(normalized_required) - len(missing)
    match_ratio = matched_count / len(normalized_required)
    
    return missing, match_ratio
