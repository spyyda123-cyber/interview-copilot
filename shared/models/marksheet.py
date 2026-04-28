from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.db.base import Base


class Marksheet(Base):
    __tablename__ = "marksheets"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    file_path: Mapped[str] = mapped_column(String(512))
    file_name: Mapped[str] = mapped_column(String(256))
    file_type: Mapped[str] = mapped_column(String(50))  # pdf, jpg, png, jpeg
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="marksheets")
