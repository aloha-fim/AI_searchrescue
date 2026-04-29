from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict

from .models import UserRole, IncidentStatus


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.VICTIM


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginIn(BaseModel):
    email: EmailStr
    password: str


# ---- Incidents ----
class IncidentCreate(BaseModel):
    summary: Optional[str] = ""
    last_lat: Optional[float] = None
    last_lon: Optional[float] = None
    persons_in_distress: int = 1
    notes: Optional[str] = ""


class IncidentUpdate(BaseModel):
    status: Optional[IncidentStatus] = None
    summary: Optional[str] = None
    last_lat: Optional[float] = None
    last_lon: Optional[float] = None
    notes: Optional[str] = None
    persons_in_distress: Optional[int] = None


class IncidentImageOut(BaseModel):
    id: int
    file_path: str
    original_filename: Optional[str] = None
    caption: Optional[str] = None
    detailed_description: Optional[str] = None
    landmarks: Optional[str] = None
    inferred_location: Optional[str] = None
    location_reasoning: Optional[str] = None
    motion_analysis: Optional[str] = None
    hazards: Optional[str] = None
    confidence: Optional[float] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    captured_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class IncidentMessageOut(BaseModel):
    id: int
    original_text: str
    detected_language: Optional[str] = None
    translated_text: Optional[str] = None
    cleaned_text: Optional[str] = None
    extracted_intent: Optional[str] = None
    urgency: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class IncidentMessageCreate(BaseModel):
    text: str


class IncidentOut(BaseModel):
    id: int
    reported_by_id: int
    status: IncidentStatus
    summary: str
    last_lat: Optional[float] = None
    last_lon: Optional[float] = None
    location_confidence: Optional[str] = None
    inferred_location_name: Optional[str] = None
    persons_in_distress: int
    notes: str
    created_at: datetime
    updated_at: datetime
    images: List[IncidentImageOut] = []
    messages: List[IncidentMessageOut] = []
    model_config = ConfigDict(from_attributes=True)


class IncidentSummary(BaseModel):
    id: int
    status: IncidentStatus
    summary: str
    last_lat: Optional[float]
    last_lon: Optional[float]
    inferred_location_name: Optional[str]
    persons_in_distress: int
    created_at: datetime
    updated_at: datetime
    image_count: int
    last_message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ---- Supplies ----
class SupplyItemCreate(BaseModel):
    name: str
    category: str = "general"
    unit: str = "each"
    quantity: float = 0
    minimum_quantity: float = 0
    location: str = "HQ"
    notes: Optional[str] = ""


class SupplyItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    minimum_quantity: Optional[float] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class SupplyItemOut(BaseModel):
    id: int
    name: str
    category: str
    unit: str
    quantity: float
    minimum_quantity: float
    location: str
    notes: str
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SupplyTransactionCreate(BaseModel):
    change: float
    reason: str = "adjustment"
    phase: str = "pre"  # pre | during | post
    incident_id: Optional[int] = None
    note: Optional[str] = ""


class SupplyTransactionOut(BaseModel):
    id: int
    item_id: int
    incident_id: Optional[int]
    change: float
    reason: str
    phase: str
    note: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
