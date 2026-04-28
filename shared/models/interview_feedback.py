"""
InterviewFeedback model — stores post-interview student feedback.

PURPOSE:
  After a student's interview date passes, they are prompted to fill
  a structured feedback form. The data collected here will later be
  used by an AI agent pipeline to:
    1. Analyse patterns in out-of-syllabus questions
    2. Measure course relevance scores across companies/roles
    3. Refine the prompt & study plan generation for future students

SCALABILITY (Agentic approach):
  - All fields are queryable via SQL (no embedded JSON blobs for key data)
  - `out_of_box_questions` is free-text to allow NLP extraction later
  - `relevance_score` (1-5 int) enables numeric aggregation
  - `company_name` + `role` allow grouping per placement drive
  - An agent can SELECT AVG(relevance_score) ... GROUP BY company_name
    to produce a relevance heat-map and feed it back into the prompt

TABLE: interview_feedbacks
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base

if TYPE_CHECKING:
    from shared.models.student import Student


class InterviewFeedback(Base):
    __tablename__ = "interview_feedbacks"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(255), default="")
    interview_date: Mapped[date] = mapped_column(Date)

    # Q1: How was the interview? (Excellent / Good / Average / Poor)
    experience_rating: Mapped[str] = mapped_column(String(50))

    # Q2: How did you perform? (Very Well / Well / Average / Below Average)
    performance_rating: Mapped[str] = mapped_column(String(50))

    # Q3: Were the courses relatable?
    course_relevance: Mapped[bool] = mapped_column(Boolean, default=True)

    # Q4: Rate the relativity on a scale of 1-5
    relevance_score: Mapped[int] = mapped_column(Integer, default=3)

    # Q5: Out of the box questions
    out_of_box_questions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Optional: additional comments
    additional_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="feedbacks")
