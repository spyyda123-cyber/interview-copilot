from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base


class TargetInterview(Base):
    __tablename__ = "target_interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str | None] = mapped_column(String(255))
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    difficulty: Mapped[str] = mapped_column(String(50), default="unknown")
    round_structure: Mapped[str] = mapped_column(String(255), default="")
    analysis_status: Mapped[str] = mapped_column(String(50), default="processing")
    analysis_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    jd_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="targets")
    gap_analyses: Mapped[list["ResumeGapAnalysis"]] = relationship(
        back_populates="target",
        cascade="all, delete-orphan",
    )

