from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from shared.db.session import get_db
from shared.models.plan import TopicProgress
from app.schemas.progress import SyncProgressPayload, TopicProgressResponse

router = APIRouter()

@router.get("/{student_id}/{target_id}", response_model=List[TopicProgressResponse])
def get_progress(student_id: int, target_id: int, db: Session = Depends(get_db)):
    records = db.query(TopicProgress).filter(
        TopicProgress.student_id == student_id,
        TopicProgress.target_id == target_id
    ).all()
    return records

@router.post("/{student_id}/{target_id}")
def sync_progress(student_id: int, target_id: int, payload: SyncProgressPayload, db: Session = Depends(get_db)):
    for update in payload.updates:
        # UPSERT logic
        existing = db.query(TopicProgress).filter(
            TopicProgress.student_id == student_id,
            TopicProgress.target_id == target_id,
            TopicProgress.topic_id == update.topic_id
        ).first()

        if existing:
            existing.status = update.status
            existing.coding_pct = update.coding_pct
            existing.quiz_done = update.quiz_done
            existing.concepts_read_count = update.concepts_read_count
        else:
            new_record = TopicProgress(
                student_id=student_id,
                target_id=target_id,
                topic_id=update.topic_id,
                status=update.status,
                coding_pct=update.coding_pct,
                quiz_done=update.quiz_done,
                concepts_read_count=update.concepts_read_count
            )
            db.add(new_record)
            
    db.commit()
    return {"status": "success", "updated_count": len(payload.updates)}
