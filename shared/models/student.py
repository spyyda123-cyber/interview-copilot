from __future__ import annotations

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base

if TYPE_CHECKING:
    from shared.models.plan import LearningPlan
    from shared.models.prep_license import PrepLicense
    from shared.models.resume import Resume
    from shared.models.resume_gap import ResumeGapAnalysis
    from shared.models.student_profile import StudentProfile
    from shared.models.target import TargetInterview


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(50))
    last_name: Mapped[Optional[str]] = mapped_column(String(50))
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255))
    roll_number: Mapped[Optional[str]] = mapped_column(String(50))
    department: Mapped[Optional[str]] = mapped_column(String(100))
    college: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["StudentProfile"] = relationship(
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
    )
    resumes: Mapped[List["Resume"]] = relationship(back_populates="student")
    targets: Mapped[List["TargetInterview"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )
    gap_analyses: Mapped[List["ResumeGapAnalysis"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )
    learning_plans: Mapped[List["LearningPlan"]] = relationship(back_populates="student")
    prep_licenses: Mapped[List["PrepLicense"]] = relationship(back_populates="student")

