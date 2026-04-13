from app.schemas.college import (
    CollegeCreate,
    CollegeDetailResponse,
    CollegeListItem,
    CollegeListResponse,
    CollegeStatusUpdate,
    CollegeUpdate,
)
from app.schemas.dashboard import DashboardActivityItem, DashboardSummaryResponse
from app.schemas.token import TokenAllocateRequest, TokenOverviewResponse, TokenUsageResponse

__all__ = [
    "CollegeCreate",
    "CollegeUpdate",
    "CollegeStatusUpdate",
    "CollegeListItem",
    "CollegeListResponse",
    "CollegeDetailResponse",
    "TokenAllocateRequest",
    "TokenOverviewResponse",
    "TokenUsageResponse",
    "DashboardActivityItem",
    "DashboardSummaryResponse",
]
