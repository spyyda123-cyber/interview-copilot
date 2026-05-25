from pydantic import BaseModel
from typing import List

class TopicProgressUpdate(BaseModel):
    topic_id: str
    status: str
    coding_pct: int = 0
    quiz_done: bool = False
    concepts_read_count: int = 0

class TopicProgressResponse(TopicProgressUpdate):
    target_id: int
    student_id: int

class SyncProgressPayload(BaseModel):
    updates: List[TopicProgressUpdate]
