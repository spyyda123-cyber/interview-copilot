from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.db.base import Base

class LLMUsageLog(Base):
    __tablename__ = "llm_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # 'openai', 'gemini'
    model: Mapped[str] = mapped_column(String(100), nullable=False)     # 'gpt-4o', 'gemini-1.5-flash'
    action: Mapped[str] = mapped_column(String(100), nullable=False)    # 'plan_generation', 'jd_analysis'
    
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    student_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
