import uuid
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text,
    ForeignKey, UniqueConstraint, Index, text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import Base

class ResourceRow(Base):
    __tablename__ = "resources"

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name      = Column(String(255), nullable=False)
    type      = Column(String(50), nullable=False)
    capacity  = Column(Integer, nullable=False)
    location  = Column(String(255), nullable=False)
    amenities = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    bookings  = relationship("BookingRow", back_populates="resource", lazy="raise")
    waitlist  = relationship("WaitlistRow", back_populates="resource", lazy="raise")

    __table_args__ = (
        Index("ix_resources_type", "type"),
    )

    def __repr__(self):
        return f"<ResourceRow id={self.id} name={self.name!r} type={self.type}>"
