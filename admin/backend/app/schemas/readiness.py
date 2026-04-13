from __future__ import annotations

from pydantic import BaseModel


class RankedCountItem(BaseModel):
    name: str
    count: int


class ReadinessOverviewResponse(BaseModel):
    average_ats_score: float | None
    coding_completion_rate: float | None
    study_plan_completion: float | None
    top_target_companies: list[RankedCountItem]
    top_target_roles: list[RankedCountItem]
    students_not_started: int
