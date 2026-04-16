"""
SCORM progress tracking API.

Endpoints:
  POST  /scorm/section/complete   — Record section completion (upsert)
  GET   /scorm/progress/{student_id}?plan_id=  — All section progress for a plan
  GET   /scorm/summary/{student_id}?plan_id=   — Plan-level completion summary
  PUT   /scorm/bookmark           — Update last-accessed bookmark

Design notes:
- ScormSectionProgress rows are upserted (update if exists, insert if new).
- ScormPlanCompletion is created on first section complete and updated thereafter.
- "passed" sections count toward sections_completed.
- A module is "completed" when ALL its sections are "passed".
- completion_status transitions: not_attempted → in_progress → completed.
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    LearningPlan,
    ScormSectionProgress,
    ScormPlanCompletion,
)
from app.schemas.scorm import (
    ScormBookmarkRequest,
    ScormProgressResponse,
    ScormSectionCompleteRequest,
    ScormSectionCompleteResponse,
    ScormSectionProgressItem,
    ScormSummaryResponse,
)

router = APIRouter(prefix="/scorm", tags=["scorm"])


# ──────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────

def _get_or_create_plan_completion(
    db: Session,
    plan_id: int,
    student_id: int,
    total_modules: int,
    total_sections: int,
) -> ScormPlanCompletion:
    """Return existing ScormPlanCompletion or create a fresh one."""
    record = (
        db.query(ScormPlanCompletion)
        .filter(ScormPlanCompletion.plan_id == plan_id)
        .first()
    )
    if not record:
        record = ScormPlanCompletion(
            plan_id=plan_id,
            student_id=student_id,
            completion_status="in_progress",
            total_modules=total_modules,
            total_sections=total_sections,
        )
        db.add(record)
        db.flush()
    else:
        # Refresh totals if plan added modules
        record.total_modules = total_modules
        record.total_sections = total_sections
    return record


def _recompute_plan_summary(
    db: Session,
    summary: ScormPlanCompletion,
    total_modules: int,
    total_sections: int,
) -> None:
    """
    Recount completed sections/modules and aggregate scores + time from DB rows.
    Called after every section upsert.
    """
    all_sections: List[ScormSectionProgress] = (
        db.query(ScormSectionProgress)
        .filter(ScormSectionProgress.plan_id == summary.plan_id)
        .all()
    )

    passed_sections = [s for s in all_sections if s.status == "passed"]
    sections_completed = len(passed_sections)

    # A module is complete when every section_index for that module_index is passed.
    # We compute which (module_index, section_index) combos exist and are passed.
    module_section_map: dict[int, set] = {}
    for s in all_sections:
        module_section_map.setdefault(s.module_index, set())
    for s in passed_sections:
        module_section_map.setdefault(s.module_index, set()).add(s.section_index)

    # We don't know total sections per module here, so use a simpler heuristic:
    # count modules where ALL recorded sections are "passed" (no failed/not_attempted sibling).
    all_module_indices = {s.module_index for s in all_sections}
    failed_or_pending = {s.module_index for s in all_sections if s.status != "passed"}
    modules_completed = len(all_module_indices - failed_or_pending)

    total_score_raw = sum(s.score_raw or 0 for s in all_sections)
    total_score_max = sum(s.score_max or 0 for s in all_sections)
    total_time = sum(s.time_spent_seconds for s in all_sections)

    summary.sections_completed = sections_completed
    summary.modules_completed = modules_completed
    summary.total_score_raw = total_score_raw
    summary.total_score_max = total_score_max
    summary.total_time_seconds = total_time
    summary.total_modules = total_modules
    summary.total_sections = total_sections
    summary.updated_at = datetime.utcnow()

    if sections_completed >= total_sections and total_sections > 0:
        summary.completion_status = "completed"
    elif sections_completed > 0:
        summary.completion_status = "in_progress"
    else:
        summary.completion_status = "not_attempted"


# ──────────────────────────────────────────────────────────────
#  POST /scorm/section/complete
# ──────────────────────────────────────────────────────────────

@router.post("/section/complete", response_model=ScormSectionCompleteResponse)
def complete_section(payload: ScormSectionCompleteRequest, db: Session = Depends(get_db)):
    """
    Record (upsert) a student's section completion.

    Called by the frontend after the student passes the section quiz
    and clicks "Next Section" or "Complete Module".

    Business rules:
    - If a row with (plan_id, module_index, section_index) already exists → update it.
    - status must be "passed" | "failed".
    - Only "passed" sections count toward completion.
    - ScormPlanCompletion is created/updated atomically.
    """
    # Validate plan belongs to student
    plan = db.query(LearningPlan).filter(
        LearningPlan.id == payload.plan_id,
        LearningPlan.student_id == payload.student_id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Learning plan not found for this student.")

    # Upsert section progress row
    existing = (
        db.query(ScormSectionProgress)
        .filter(
            ScormSectionProgress.plan_id == payload.plan_id,
            ScormSectionProgress.module_index == payload.module_index,
            ScormSectionProgress.section_index == payload.section_index,
        )
        .first()
    )

    if existing:
        existing.status = payload.status
        existing.score_raw = payload.score_raw
        existing.score_max = payload.score_max
        existing.time_spent_seconds += payload.time_spent_seconds
        existing.attempts += 1
        existing.section_title = payload.section_title
        if payload.status == "passed":
            existing.completion_date = datetime.utcnow()
        existing.updated_at = datetime.utcnow()
        section_row = existing
    else:
        section_row = ScormSectionProgress(
            plan_id=payload.plan_id,
            student_id=payload.student_id,
            module_index=payload.module_index,
            section_index=payload.section_index,
            section_title=payload.section_title,
            status=payload.status,
            score_raw=payload.score_raw,
            score_max=payload.score_max,
            time_spent_seconds=payload.time_spent_seconds,
            attempts=1,
            completion_date=datetime.utcnow() if payload.status == "passed" else None,
        )
        db.add(section_row)
        db.flush()

    # Create/update plan-level summary
    summary = _get_or_create_plan_completion(
        db,
        plan_id=payload.plan_id,
        student_id=payload.student_id,
        total_modules=payload.total_modules,
        total_sections=payload.total_sections,
    )
    _recompute_plan_summary(db, summary, payload.total_modules, payload.total_sections)

    # Advance bookmark to the next section
    next_section = payload.section_index + 1
    next_module = payload.module_index
    # If last section in module, advance module
    # (frontend sends total_sections per plan, not per module —
    #  bookmark is just a hint, frontend decides routing)
    summary.last_accessed_module = next_module
    summary.last_accessed_section = next_section

    db.commit()

    return ScormSectionCompleteResponse(
        ok=True,
        plan_id=payload.plan_id,
        completion_status=summary.completion_status,
        sections_completed=summary.sections_completed,
        total_sections=summary.total_sections,
    )


# ──────────────────────────────────────────────────────────────
#  GET /scorm/progress/{student_id}
# ──────────────────────────────────────────────────────────────

@router.get("/progress/{student_id}", response_model=ScormProgressResponse)
def get_progress(
    student_id: int,
    plan_id: int = Query(..., description="Learning plan ID"),
    db: Session = Depends(get_db),
):
    """
    Return all section-level SCORM progress for a student's plan.

    Used by the study-plan page on load to restore:
    - Which sections are completed (status == "passed")
    - Score and time data per section
    - So the frontend can rebuild completed_sections[] and set currentSectionIdx
    """
    plan = db.query(LearningPlan).filter(
        LearningPlan.id == plan_id,
        LearningPlan.student_id == student_id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Learning plan not found.")

    rows: List[ScormSectionProgress] = (
        db.query(ScormSectionProgress)
        .filter(
            ScormSectionProgress.plan_id == plan_id,
            ScormSectionProgress.student_id == student_id,
        )
        .order_by(ScormSectionProgress.module_index, ScormSectionProgress.section_index)
        .all()
    )

    return ScormProgressResponse(
        plan_id=plan_id,
        student_id=student_id,
        sections=[ScormSectionProgressItem.model_validate(r) for r in rows],
    )


# ──────────────────────────────────────────────────────────────
#  GET /scorm/summary/{student_id}
# ──────────────────────────────────────────────────────────────

@router.get("/summary/{student_id}", response_model=ScormSummaryResponse)
def get_summary(
    student_id: int,
    plan_id: int = Query(..., description="Learning plan ID"),
    db: Session = Depends(get_db),
):
    """
    Return plan-level SCORM completion summary.

    Includes the bookmark (last_accessed_module / last_accessed_section)
    so the frontend can auto-navigate to where the student left off.
    """
    plan = db.query(LearningPlan).filter(
        LearningPlan.id == plan_id,
        LearningPlan.student_id == student_id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Learning plan not found.")

    summary = (
        db.query(ScormPlanCompletion)
        .filter(
            ScormPlanCompletion.plan_id == plan_id,
            ScormPlanCompletion.student_id == student_id,
        )
        .first()
    )

    if not summary:
        # No progress yet — return a zeroed summary
        return ScormSummaryResponse(
            plan_id=plan_id,
            student_id=student_id,
            completion_status="not_attempted",
            modules_completed=0,
            total_modules=0,
            sections_completed=0,
            total_sections=0,
            total_score_raw=0,
            total_score_max=0,
            total_time_seconds=0,
            last_accessed_module=0,
            last_accessed_section=0,
            updated_at=None,
        )

    return ScormSummaryResponse.model_validate(summary)


# ──────────────────────────────────────────────────────────────
#  PUT /scorm/bookmark
# ──────────────────────────────────────────────────────────────

@router.put("/bookmark", response_model=dict)
def update_bookmark(payload: ScormBookmarkRequest, db: Session = Depends(get_db)):
    """
    Update the last-accessed module/section bookmark.

    Called when the student navigates between sections (without completing them).
    Lightweight — only updates the bookmark fields, no score/time changes.
    """
    summary = (
        db.query(ScormPlanCompletion)
        .filter(
            ScormPlanCompletion.plan_id == payload.plan_id,
            ScormPlanCompletion.student_id == payload.student_id,
        )
        .first()
    )

    if not summary:
        # Create a minimal completion record with just the bookmark
        summary = ScormPlanCompletion(
            plan_id=payload.plan_id,
            student_id=payload.student_id,
            completion_status="in_progress",
            last_accessed_module=payload.module_index,
            last_accessed_section=payload.section_index,
        )
        db.add(summary)
    else:
        summary.last_accessed_module = payload.module_index
        summary.last_accessed_section = payload.section_index
        summary.updated_at = datetime.utcnow()
        if summary.completion_status == "not_attempted":
            summary.completion_status = "in_progress"

    db.commit()
    return {"ok": True}
