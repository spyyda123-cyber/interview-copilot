from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base


class ResumeGapAnalysis(Base):
    __tablename__ = "resume_gap_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("target_interviews.id"), index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"), index=True)
    missing_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    keyword_score: Mapped[float] = mapped_column(Float, default=0.0)
    ats_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="gap_analyses")
    target: Mapped["TargetInterview"] = relationship(back_populates="gap_analyses")
    resume: Mapped["Resume"] = relationship(back_populates="gap_analyses")

