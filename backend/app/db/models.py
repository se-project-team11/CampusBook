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

class BookingRow(Base):
    __tablename__ = "bookings"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id           = Column(UUID(as_uuid=True), nullable=False)
    resource_id       = Column(
        UUID(as_uuid=True), ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False
    )
    slot_start        = Column(DateTime(timezone=True), nullable=False)
    slot_end          = Column(DateTime(timezone=True), nullable=False)
    state             = Column(String(20), nullable=False, server_default=text("'RESERVED'"))
    qr_token          = Column(String(100), unique=True, nullable=True)
    requires_approval = Column(Boolean, nullable=False, server_default=text("false"))
    notes             = Column(Text, nullable=False, server_default=text("''"))
    created_at        = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    expires_at        = Column(DateTime(timezone=True), nullable=True)

    resource = relationship("ResourceRow", back_populates="bookings", lazy="raise")

    __table_args__ = (
        Index("ix_bookings_resource_slot", "resource_id", "slot_start", "slot_end"),
        Index("ix_bookings_user_id", "user_id"),
        Index("ix_bookings_state", "state"),
    )

    def __repr__(self):
        return f"<BookingRow id={self.id} state={self.state} resource={self.resource_id}>"

class DomainEventRow(Base):
    __tablename__ = "domain_events"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type  = Column(String(100), nullable=False)
    payload     = Column(JSONB, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        Index("ix_domain_events_type", "event_type"),
        Index("ix_domain_events_occurred_at", "occurred_at"),
    )

    def __repr__(self):
        return f"<DomainEventRow type={self.event_type} at={self.occurred_at}>"
