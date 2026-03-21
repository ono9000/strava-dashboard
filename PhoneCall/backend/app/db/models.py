import uuid
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Operator(Base):
    __tablename__ = "operators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Workshop(Base):
    __tablename__ = "workshops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    country = Column(String(2), nullable=False)
    language_codes = Column(ARRAY(String), nullable=False, default=list)
    services = Column(ARRAY(String), nullable=False, default=list)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    priority_score = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    incidents = relationship("Incident", back_populates="workshop")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    status = Column(String, nullable=False, default="NEW")

    driver_phone = Column(String, nullable=False)
    driver_language = Column(String(5), nullable=True)
    driver_name = Column(String, nullable=True)
    plate_number = Column(String, nullable=True)
    truck_company = Column(String, nullable=True)

    issue_type = Column(String, nullable=True)
    issue_description = Column(Text, nullable=True)
    risk_level = Column(String, default="low", nullable=False)

    location_text = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    assigned_workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"), nullable=True)
    eta_minutes = Column(Integer, nullable=True)

    escalation_required = Column(Boolean, default=False, nullable=False)
    escalation_reason = Column(Text, nullable=True)
    abrupt_end = Column(Boolean, default=False, nullable=False)
    driver_disconnected_mid_contact = Column(Boolean, default=False, nullable=False)

    claimed_by_operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)

    workshop = relationship("Workshop", back_populates="incidents")
    call_logs = relationship("CallLog", back_populates="incident")
    claimed_by = relationship("Operator", foreign_keys=[claimed_by_operator_id])


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    call_type = Column(String, nullable=False)  # driver | workshop | operator
    attempt_number = Column(Integer, nullable=False, default=1)
    twilio_call_sid = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    transcript = Column(Text, nullable=True)
    structured_result = Column(JSONB, nullable=True)
    success = Column(Boolean, nullable=True)
    escalation_reason = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="call_logs")
