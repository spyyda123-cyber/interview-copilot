"""
Pydantic schemas for interview feedback endpoints.

Designed for structured data collection that supports future
agentic AI analysis of feedback patterns.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class FeedbackSubmitRequest(BaseModel):
    """Request body for submitting post-interview feedback."""
    student_id: int
    company_name: str
    role: str = ""
    interview_date: date
    experience_rating: str = Field(
        ...,
        description="How was the interview? Options: Excellent, Good, Average, Poor"
    )
    performance_rating: str = Field(
        ...,
        description="How did you perform? Options: Very Well, Well, Average, Below Average"
    )
    course_relevance: bool = Field(
        ...,
        description="Were the courses relatable to the interview?"
    )
    relevance_score: int = Field(
        ...,
        ge=1,
        le=5,
        description="Rate course relevance on a scale of 1-5"
    )
    out_of_box_questions: Optional[str] = Field(
        None,
        description="Questions that were NOT part of the courses — free text"
    )
    additional_notes: Optional[str] = None


class FeedbackResponse(BaseModel):
    """Single feedback record returned to frontend."""
    id: int
    student_id: int
    company_name: str
    role: str
    interview_date: date
    experience_rating: str
    performance_rating: str
    course_relevance: bool
    relevance_score: int
    out_of_box_questions: Optional[str]
    additional_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PendingFeedbackItem(BaseModel):
    """An interview that needs feedback from the student."""
    company_name: str
    role: str
    interview_date: date

    class Config:
        from_attributes = True


class PendingFeedbackResponse(BaseModel):
    """List of interviews needing feedback after login."""
    pending: list[PendingFeedbackItem]
    count: int
