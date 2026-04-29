from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Column, Integer, String, Text, Float, ForeignKey, DateTime, Boolean, Enum as SAEnum
)
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, Enum):
    VICTIM = "victim"
    PILOT = "pilot"
    SWIMMER = "swimmer"
    WATCHSTANDER = "watchstander"
    ADMIN = "admin"


class IncidentStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.VICTIM)
    created_at = Column(DateTime, default=datetime.utcnow)

    incidents = relationship("Incident", back_populates="reporter", foreign_keys="Incident.reported_by_id")


class Incident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True)
    reported_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(IncidentStatus, name="incident_status"), default=IncidentStatus.OPEN, nullable=False)
    summary = Column(Text, default="")

    # Last known position (best-effort: GPS, EXIF, or inferred from imagery)
    last_lat = Column(Float, nullable=True)
    last_lon = Column(Float, nullable=True)
    location_confidence = Column(String, nullable=True)  # e.g. "gps", "exif", "inferred"
    inferred_location_name = Column(String, nullable=True)

    persons_in_distress = Column(Integer, default=1)
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reporter = relationship("User", back_populates="incidents", foreign_keys=[reported_by_id])
    images = relationship("IncidentImage", back_populates="incident", cascade="all, delete-orphan")
    messages = relationship("IncidentMessage", back_populates="incident", cascade="all, delete-orphan")


class IncidentImage(Base):
    __tablename__ = "incident_images"
    id = Column(Integer, primary_key=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    file_path = Column(String, nullable=False)
    original_filename = Column(String)
    mime_type = Column(String)

    # AI-derived
    caption = Column(Text)                       # short caption
    detailed_description = Column(Text)          # longer description
    landmarks = Column(Text)                     # comma-separated or JSON-as-text
    inferred_location = Column(String)           # e.g. "Likely Mariana Islands"
    location_reasoning = Column(Text)            # why the model thinks so
    motion_analysis = Column(Text)               # what motion the model detects
    hazards = Column(Text)                       # detected hazards (fire, sinking, injury)
    confidence = Column(Float)                   # 0..1 overall

    # EXIF-derived
    gps_lat = Column(Float, nullable=True)
    gps_lon = Column(Float, nullable=True)
    captured_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="images")


class IncidentMessage(Base):
    __tablename__ = "incident_messages"
    id = Column(Integer, primary_key=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)

    original_text = Column(Text, nullable=False)
    detected_language = Column(String)
    translated_text = Column(Text)
    cleaned_text = Column(Text)            # cleaned-up understandable English
    extracted_intent = Column(Text)        # e.g. "needs medical help, cannot swim"
    urgency = Column(String)               # low | medium | high | critical

    created_at = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="messages")


class SupplyItem(Base):
    __tablename__ = "supply_items"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    category = Column(String, nullable=False, default="general")  # medical, fuel, food, water, gear, comms
    unit = Column(String, default="each")
    quantity = Column(Float, default=0.0)
    minimum_quantity = Column(Float, default=0.0)
    location = Column(String, default="HQ")
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("SupplyTransaction", back_populates="item", cascade="all, delete-orphan")


class SupplyTransaction(Base):
    __tablename__ = "supply_transactions"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("supply_items.id"), nullable=False)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    change = Column(Float, nullable=False)  # negative = consumed, positive = restocked
    reason = Column(String, default="")     # "deployed", "restocked", "adjustment"
    phase = Column(String, default="pre")   # "pre", "during", "post"
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("SupplyItem", back_populates="transactions")
