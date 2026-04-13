from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base


class PlacementCompany(Base):
    __tablename__ = "placement_companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    package_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    package_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    interview_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    min_cgpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_backlogs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    eligible_departments: Mapped[list[str]] = mapped_column(JSON, default=list)
    job_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    exemption_list: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(50), default="Review", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    applications: Mapped[list[PlacementApplication]] = relationship("PlacementApplication", back_populates="company", cascade="all, delete-orphan")


class PlacementApplication(Base):
    __tablename__ = "placement_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("placement_companies.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Statuses: INTERESTED, APPROVED, REJECTED, ACTIVATED
    status: Mapped[str] = mapped_column(String(50), default="INTERESTED", nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company: Mapped[PlacementCompany] = relationship("PlacementCompany", back_populates="applications")
    student= relationship("User", viewonly=True)
