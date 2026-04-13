from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base

if TYPE_CHECKING:
    from shared.models.student import Student


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), unique=True, index=True)
    primary_skill: Mapped[str] = mapped_column(String(255))
    known_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    support_mode: Mapped[str] = mapped_column(String(50))
    tone: Mapped[str] = mapped_column(String(50))
    coding_required: Mapped[bool] = mapped_column(Boolean, default=True)
    marksheets: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="profile")

