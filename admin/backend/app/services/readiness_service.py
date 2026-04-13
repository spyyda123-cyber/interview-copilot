from __future__ import annotations

from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from shared.models import (
    LearningPlan,
    LearningTask,
    ResumeGapAnalysis,
    Student,
    TargetInterview,
    User,
    UserRole,
    UserStatus,
)


def _bridged_students_by_college(db: Session, college_id: UUID):
    users = (
        db.query(User)
        .filter(User.college_id == college_id, User.role == UserRole.STUDENT)
        .all()
    )
    emails = [u.email for u in users if u.email]
    if not emails:
        return users, {}

    students = db.query(Student).filter(Student.email.in_(emails)).all()
    return users, {s.email: s for s in students if s.email}


def get_readiness_overview(db: Session, college_id: UUID) -> dict:
    users, bridge = _bridged_students_by_college(db, college_id)

    ats_scores: list[float] = []
    plan_percentages: list[float] = []
    bridged_student_ids: list[int] = []

    for user in users:
        legacy = bridge.get(user.email)
        if not legacy:
            continue
        bridged_student_ids.append(legacy.id)

        latest_gap = (
            db.query(ResumeGapAnalysis)
            .filter(ResumeGapAnalysis.student_id == legacy.id)
            .order_by(ResumeGapAnalysis.created_at.desc())
            .first()
        )
        if latest_gap and latest_gap.ats_score is not None:
            ats_scores.append(float(latest_gap.ats_score))

        latest_plan = (
            db.query(LearningPlan)
            .filter(LearningPlan.student_id == legacy.id)
            .order_by(LearningPlan.created_at.desc())
            .first()
        )
        if latest_plan:
            total_tasks = (
                db.query(func.count(LearningTask.id))
                .filter(LearningTask.plan_id == latest_plan.id)
                .scalar()
                or 0
            )
            completed_tasks = (
                db.query(func.count(LearningTask.id))
                .filter(LearningTask.plan_id == latest_plan.id, LearningTask.task_order <= 0)
                .scalar()
                or 0
            )
            if total_tasks > 0:
                plan_percentages.append(float(completed_tasks) / float(total_tasks) * 100.0)

    top_companies: list[dict] = []
    top_roles: list[dict] = []
    if bridged_student_ids:
        company_rows = (
            db.query(TargetInterview.company_name, func.count(TargetInterview.id).label("count"))
            .filter(TargetInterview.student_id.in_(bridged_student_ids))
            .group_by(TargetInterview.company_name)
            .order_by(func.count(TargetInterview.id).desc())
            .limit(5)
            .all()
        )
        role_rows = (
            db.query(TargetInterview.role, func.count(TargetInterview.id).label("count"))
            .filter(TargetInterview.student_id.in_(bridged_student_ids), TargetInterview.role.isnot(None))
            .group_by(TargetInterview.role)
            .order_by(func.count(TargetInterview.id).desc())
            .limit(5)
            .all()
        )

        top_companies = [{"name": company, "count": int(count)} for company, count in company_rows if company]
        top_roles = [{"name": role, "count": int(count)} for role, count in role_rows if role]

    started_emails = set(bridge.keys())
    students_not_started = sum(
        1
        for user in users
        if user.status == UserStatus.ACTIVE and user.email and user.email not in started_emails
    )

    return {
        "average_ats_score": (sum(ats_scores) / len(ats_scores)) if ats_scores else None,
        "coding_completion_rate": None,  # TODO: wire when coding module tracking is available.
        "study_plan_completion": (sum(plan_percentages) / len(plan_percentages)) if plan_percentages else None,
        "top_target_companies": top_companies,
        "top_target_roles": top_roles,
        "students_not_started": students_not_started,
    }
