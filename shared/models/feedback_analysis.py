"""
FeedbackAnalysisCache — stores per-company aggregated feedback intelligence.

PURPOSE:
  Nightly Celery agent (analyze_feedback_batch) reads all interview_feedbacks,
  runs SQL aggregations + Ollama NLP, and writes pre-built intelligence snippets
  here. Plan generation reads from this table — NOT from raw feedback rows —
  so the LLM never receives raw student PII.

AGENTIC PIPELINE POSITION:
  interview_feedbacks (raw)
      ↓ analyze_feedback_batch() [Celery Beat, nightly]
      ↓ Ollama llama3.2 NLP extraction
  feedback_analysis_cache (aggregated, safe)
      ↓ _get_feedback_intelligence() [plan_service.py]
  LLM Prompt (enriched) → Better Study Plans

TABLE: feedback_analysis_cache
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from shared.db.base import Base


class FeedbackAnalysisCache(Base):
    __tablename__ = "feedback_analysis_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    # ── SQL-aggregated metrics (no LLM needed) ──────────────────────────────
    feedback_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_relevance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irrelevant_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-100 %
    most_common_experience: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    most_common_performance: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # ── Ollama NLP extraction ─────────────────────────────────────────────
    # JSON array: [{"topic": "consistent hashing", "frequency": 3, "category": "System Design"}]
    missing_topics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Pre-built paragraph ready to inject directly into plan prompts
    prompt_snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Housekeeping ──────────────────────────────────────────────────────
    last_refreshed: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # SHA256 of concatenated feedback IDs — used to detect staleness cheaply
    feedback_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
