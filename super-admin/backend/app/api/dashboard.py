from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard_service import get_dashboard_summary
from shared.auth.dependencies import require_super_admin
from shared.db.session import get_db


router = APIRouter(tags=["Dashboard"], dependencies=[Depends(require_super_admin)])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(db: Session = Depends(get_db)):
    return get_dashboard_summary(db)
