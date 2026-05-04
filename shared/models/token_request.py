from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base


class TokenRequest(Base):
    """Represents a token request submitted by a college admin to the super admin."""
    __tablename__ = "token_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    requested_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status: PENDING, FULFILLED, REJECTED
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    college = relationship("College", viewonly=True)
    requested_by = relationship("User", viewonly=True)
