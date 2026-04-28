"""
Feedback API — post-interview student feedback collection.

ENDPOINTS:
  POST  /feedback/submit               — Submit feedback for an interview
  GET   /feedback/pending/{student_id}  — Interviews needing feedback (past dates, no feedback yet)
  GET   /feedback/{student_id}/{company} — Get specific feedback
  GET   /feedback/all/{student_id}      — All feedbacks for a student
  POST  /feedback/agent/run             — Manually trigger agentic analysis (admin use)
  GET   /feedback/agent/status          — View current feedback_analysis_cache

DESIGN FOR AGENTIC SCALABILITY:
  The data model stores each feedback dimension in its own column so that
  downstream AI agents can:
    1. Run SQL aggregations (AVG relevance_score GROUP BY company_name)
    2. Extract patterns from out_of_box_questions via Ollama NLP
    3. Feed aggregated insights back into the study plan prompt
    4. Build a knowledge graph of "company → unexpected topics"
"""

import logging
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Student, InterviewFeedback
from app.schemas.feedback import (
    FeedbackSubmitRequest,
    FeedbackResponse,
    PendingFeedbackItem,
    PendingFeedbackResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/submit", response_model=FeedbackResponse)
def submit_feedback(payload: FeedbackSubmitRequest, db: Session = Depends(get_db)):
    """Submit post-interview feedback.

    Validates:
      - Student exists
      - No duplicate feedback for same student + company + interview_date

    After successful save, triggers the agentic feedback analysis task in
    the background so the next student's study plan benefits from this data.
    """
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check for duplicate
    existing = (
        db.query(InterviewFeedback)
        .filter(
            InterviewFeedback.student_id == payload.student_id,
            InterviewFeedback.company_name == payload.company_name,
            InterviewFeedback.interview_date == payload.interview_date,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="Feedback already submitted for this interview"
        )

    feedback = InterviewFeedback(
        student_id=payload.student_id,
        company_name=payload.company_name,
        role=payload.role,
        interview_date=payload.interview_date,
        experience_rating=payload.experience_rating,
        performance_rating=payload.performance_rating,
        course_relevance=payload.course_relevance,
        relevance_score=payload.relevance_score,
        out_of_box_questions=payload.out_of_box_questions,
        additional_notes=payload.additional_notes,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    # ── Trigger agentic analysis for this company (background, non-blocking) ──
    try:
        from app.tasks.jobs import analyze_company_feedback
        analyze_company_feedback.delay(payload.company_name)
        logger.info(
            "[FEEDBACK-AGENT] Enqueued analysis for company=%s after new feedback id=%s",
            payload.company_name, feedback.id,
        )
    except Exception as agent_exc:
        # Never fail the submission because of the agent — graceful degradation
        logger.warning("[FEEDBACK-AGENT] Failed to enqueue analysis: %s", agent_exc)

    return feedback


@router.get("/pending/{student_id}", response_model=PendingFeedbackResponse)
def get_pending_feedbacks(student_id: int, db: Session = Depends(get_db)):
    """Return interviews where date has passed but no feedback submitted.

    This is used on login to auto-popup the feedback modal.
    We look at APPROVED_INTERVIEWS (hardcoded for now) and check which
    ones have past interview dates with no feedback row in the DB.

    In future: this will query placement_applications + placement_companies
    to dynamically determine which interviews are past-due.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get all feedbacks already submitted by this student
    submitted = (
        db.query(InterviewFeedback.company_name, InterviewFeedback.interview_date)
        .filter(InterviewFeedback.student_id == student_id)
        .all()
    )
    submitted_set = {(f.company_name, f.interview_date) for f in submitted}

    # Hardcoded interview list — matches frontend APPROVED_INTERVIEWS
    # In production, this would be dynamic from placement_companies table
    interviews = [
        {"company_name": "TCS", "role": "Java Backend Developer", "interview_date": date(2026, 3, 25)},
        {"company_name": "Google", "role": "SDE Intern", "interview_date": date(2026, 4, 2)},
        {"company_name": "Infosys", "role": "Systems Engineer", "interview_date": date(2026, 4, 10)},
    ]

    today = date.today()
    pending = []
    for interview in interviews:
        d = interview["interview_date"]
        if d < today and (interview["company_name"], d) not in submitted_set:
            pending.append(
                PendingFeedbackItem(
                    company_name=interview["company_name"],
                    role=interview["role"],
                    interview_date=d,
                )
            )

    return PendingFeedbackResponse(pending=pending, count=len(pending))


@router.get("/detail/{student_id}/{company_name}", response_model=list[FeedbackResponse])
def get_feedback_by_company(
    student_id: int, company_name: str, db: Session = Depends(get_db)
):
    """Get all feedback for a specific student + company."""
    feedbacks = (
        db.query(InterviewFeedback)
        .filter(
            InterviewFeedback.student_id == student_id,
            InterviewFeedback.company_name == company_name,
        )
        .order_by(InterviewFeedback.created_at.desc())
        .all()
    )
    return feedbacks


@router.get("/all/{student_id}", response_model=list[FeedbackResponse])
def get_all_feedbacks(student_id: int, db: Session = Depends(get_db)):
    """Get all feedback submissions for a student.

    Used by the dashboard to display feedback history.
    Also used by AI agents to analyze patterns across all interviews.
    """
    feedbacks = (
        db.query(InterviewFeedback)
        .filter(InterviewFeedback.student_id == student_id)
        .order_by(InterviewFeedback.created_at.desc())
        .all()
    )
    return feedbacks


# ── Agentic Admin Endpoints ────────────────────────────────────────────────────

@router.post("/agent/run")
def run_agent_analysis(db: Session = Depends(get_db)):
    """
    Manually trigger the full agentic feedback batch analysis.

    Use this to force-refresh the feedback_analysis_cache without waiting
    for the nightly Celery Beat schedule.

    Returns immediately with a task ID — check /agent/status for results.
    """
    try:
        from app.tasks.jobs import analyze_feedback_batch
        task = analyze_feedback_batch.delay()
        logger.info("[FEEDBACK-AGENT] Manual batch analysis triggered, task_id=%s", task.id)
        return {
            "status": "queued",
            "task_id": task.id,
            "message": "Agentic feedback analysis started in background. Check /feedback/agent/status for results.",
        }
    except Exception as exc:
        logger.error("[FEEDBACK-AGENT] Failed to trigger batch analysis: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to trigger analysis: {exc}")


@router.get("/agent/status")
def get_agent_status(db: Session = Depends(get_db)):
    """
    View the current state of the feedback_analysis_cache.

    Shows what the agent has learned per company:
    - avg_relevance, irrelevant_pct
    - extracted missing_topics (from Ollama)
    - last_refreshed timestamp
    - prompt_snippet (what gets injected into plan prompts)
    """
    from shared.models.feedback_analysis import FeedbackAnalysisCache

    caches = db.query(FeedbackAnalysisCache).order_by(
        FeedbackAnalysisCache.feedback_count.desc()
    ).all()

    if not caches:
        return {
            "status": "empty",
            "message": "No feedback has been analysed yet. Submit feedback or run POST /feedback/agent/run.",
            "companies": [],
        }

    return {
        "status": "ok",
        "total_companies_analysed": len(caches),
        "companies": [
            {
                "company_name": c.company_name,
                "feedback_count": c.feedback_count,
                "avg_relevance": c.avg_relevance,
                "irrelevant_pct": c.irrelevant_pct,
                "most_common_experience": c.most_common_experience,
                "most_common_performance": c.most_common_performance,
                "missing_topics": c.missing_topics,
                "last_refreshed": c.last_refreshed.isoformat() if c.last_refreshed else None,
                "prompt_snippet": c.prompt_snippet,
            }
            for c in caches
        ],
    }
