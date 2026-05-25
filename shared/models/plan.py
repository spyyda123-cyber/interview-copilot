from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base

if TYPE_CHECKING:
    from shared.models.student import Student


class LearningPlan(Base):
    __tablename__ = "learning_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(255), default="")
    days_available: Mapped[int] = mapped_column(Integer)
    plan_signature: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    plan_json: Mapped[dict] = mapped_column(JSON)
    tasks_generated: Mapped[int] = mapped_column(Integer, default=0)
    summary_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    plan_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="learning_plans")
    tasks: Mapped[List["LearningTask"]] = relationship(back_populates="plan", cascade="all, delete-orphan")
    scorm_sections: Mapped[List["ScormSectionProgress"]] = relationship(back_populates="plan", cascade="all, delete-orphan")
    scorm_completion: Mapped[Optional["ScormPlanCompletion"]] = relationship(back_populates="plan", uselist=False, cascade="all, delete-orphan")

    # NOTE: plan_type and failure_reason columns are added via migrations:
    # - app/db/migrate_plan_type.py
    # - app/db/migrate_failure_reason.py


class LearningTask(Base):
    __tablename__ = "learning_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("learning_plans.id"), index=True)
    day: Mapped[int] = mapped_column(Integer)
    task_order: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    task_type: Mapped[str] = mapped_column(String(50), default="text") # text, qa, code
    qa_pairs: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    quiz: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    code_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    plan: Mapped["LearningPlan"] = relationship(back_populates="tasks")


class ScormSectionProgress(Base):
    """
    SCORM xAPI-inspired per-section progress tracker.

    One row per (plan_id, module_index, section_index).
    Upserted on every section completion event from the frontend.

    Status values (SCORM 2004):
      not_attempted | passed | failed
    """
    __tablename__ = "scorm_section_progress"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("learning_plans.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    module_index: Mapped[int] = mapped_column(Integer)
    section_index: Mapped[int] = mapped_column(Integer)
    section_title: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(30), default="not_attempted")
    score_raw: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    completion_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan: Mapped["LearningPlan"] = relationship(back_populates="scorm_sections")


class ScormPlanCompletion(Base):
    """
    SCORM course-level completion summary for a student's learning plan.

    One row per plan_id (unique).
    Stores the bookmark (last_accessed_module/section) so the frontend can resume.
    Updated each time a section is completed.
    """
    __tablename__ = "scorm_plan_completion"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("learning_plans.id"), unique=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    completion_status: Mapped[str] = mapped_column(String(30), default="not_attempted")
    modules_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_modules: Mapped[int] = mapped_column(Integer, default=0)
    sections_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_sections: Mapped[int] = mapped_column(Integer, default=0)
    total_score_raw: Mapped[int] = mapped_column(Integer, default=0)
    total_score_max: Mapped[int] = mapped_column(Integer, default=0)
    total_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    last_accessed_module: Mapped[int] = mapped_column(Integer, default=0)
    last_accessed_section: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan: Mapped["LearningPlan"] = relationship(back_populates="scorm_completion")


class TopicProgress(Base):
    """
    Tracks a student's progress on individual topics within a specific placement target.
    """
    __tablename__ = "topic_progress"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("target_interviews.id"), index=True)
    topic_id: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(50), default="started") # "started", "completed"
    coding_pct: Mapped[int] = mapped_column(Integer, default=0)
    quiz_done: Mapped[bool] = mapped_column(Boolean, default=False)
    concepts_read_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
