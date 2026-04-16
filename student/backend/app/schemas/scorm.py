"""
Pydantic schemas for the SCORM tracking API.

Follows SCORM 2004 terminology:
- completion_status: not_attempted | in_progress | completed
- success_status per section: not_attempted | passed | failed
- score: raw + max
- session_time: cumulative seconds spent
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


# ─────────────────────────────────────────────
#  REQUEST SCHEMAS
# ─────────────────────────────────────────────

class ScormSectionCompleteRequest(BaseModel):
    """
    Sent by the frontend when a student finishes a section quiz.
    Triggers an upsert on scorm_section_progress and updates the plan summary.
    """
    plan_id: int
    student_id: int
    module_index: int
    section_index: int
    section_title: str
    status: str  # "passed" | "failed"
    score_raw: int
    score_max: int
    time_spent_seconds: int
    # Totals across the whole plan — used to update ScormPlanCompletion
    total_modules: int
    total_sections: int


class ScormBookmarkRequest(BaseModel):
    """
    Sent whenever the student navigates to a new module/section.
    Updates only the last_accessed_* bookmark fields.
    """
    plan_id: int
    student_id: int
    module_index: int
    section_index: int


# ─────────────────────────────────────────────
#  RESPONSE SCHEMAS
# ─────────────────────────────────────────────

class ScormSectionProgressItem(BaseModel):
    id: int
    plan_id: int
    student_id: int
    module_index: int
    section_index: int
    section_title: str
    status: str
    score_raw: Optional[int]
    score_max: Optional[int]
    time_spent_seconds: int
    attempts: int
    completion_date: Optional[datetime]
    updated_at: datetime

    class Config:
        from_attributes = True


class ScormProgressResponse(BaseModel):
    """Full section-level progress list for a plan."""
    plan_id: int
    student_id: int
    sections: List[ScormSectionProgressItem]


class ScormSummaryResponse(BaseModel):
    """Overall plan-level completion summary."""
    plan_id: int
    student_id: int
    completion_status: str
    modules_completed: int
    total_modules: int
    sections_completed: int
    total_sections: int
    total_score_raw: int
    total_score_max: int
    total_time_seconds: int
    last_accessed_module: int
    last_accessed_section: int
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ScormSectionCompleteResponse(BaseModel):
    ok: bool
    plan_id: int
    completion_status: str
    sections_completed: int
    total_sections: int
