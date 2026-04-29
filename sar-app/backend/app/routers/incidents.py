from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, RescuerRoles
from ..database import get_db
from ..models import (
    Incident, IncidentImage, IncidentMessage, IncidentStatus, User, UserRole
)
from ..schemas import (
    IncidentCreate, IncidentUpdate, IncidentOut, IncidentSummary,
    IncidentImageOut, IncidentMessageCreate, IncidentMessageOut,
)
from ..services.storage import save_upload, extract_exif
from ..services.vision import analyze_image
from ..services.translation import translate_message

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _is_rescuer(user: User) -> bool:
    return user.role in RescuerRoles


def _can_view(user: User, incident: Incident) -> bool:
    return _is_rescuer(user) or incident.reported_by_id == user.id


@router.post("", response_model=IncidentOut)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    incident = Incident(
        reported_by_id=user.id,
        summary=payload.summary or "",
        last_lat=payload.last_lat,
        last_lon=payload.last_lon,
        location_confidence="gps" if payload.last_lat is not None else None,
        persons_in_distress=payload.persons_in_distress,
        notes=payload.notes or "",
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("", response_model=List[IncidentSummary])
def list_incidents(
    status: Optional[IncidentStatus] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Incident)
    if not _is_rescuer(user):
        q = q.filter(Incident.reported_by_id == user.id)
    if status:
        q = q.filter(Incident.status == status)
    q = q.order_by(desc(Incident.updated_at)).limit(200)

    out: List[IncidentSummary] = []
    for inc in q.all():
        last_msg = (
            db.query(IncidentMessage)
            .filter(IncidentMessage.incident_id == inc.id)
            .order_by(desc(IncidentMessage.created_at))
            .first()
        )
        image_count = (
            db.query(IncidentImage).filter(IncidentImage.incident_id == inc.id).count()
        )
        out.append(
            IncidentSummary(
                id=inc.id,
                status=inc.status,
                summary=inc.summary,
                last_lat=inc.last_lat,
                last_lon=inc.last_lon,
                inferred_location_name=inc.inferred_location_name,
                persons_in_distress=inc.persons_in_distress,
                created_at=inc.created_at,
                updated_at=inc.updated_at,
                image_count=image_count,
                last_message=(last_msg.cleaned_text or last_msg.translated_text or last_msg.original_text)
                if last_msg
                else None,
            )
        )
    return out


@router.get("/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inc = (
        db.query(Incident)
        .options(joinedload(Incident.images), joinedload(Incident.messages))
        .filter(Incident.id == incident_id)
        .first()
    )
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not _can_view(user, inc):
        raise HTTPException(status_code=403, detail="Forbidden")
    return inc


@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not _can_view(user, inc):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Only rescuers can change status
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and not _is_rescuer(user):
        raise HTTPException(status_code=403, detail="Only rescuers may change status")

    for key, value in data.items():
        setattr(inc, key, value)
    db.commit()
    db.refresh(inc)
    return inc


# ------- images -------

@router.post("/{incident_id}/images", response_model=IncidentImageOut)
def upload_image(
    incident_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not _can_view(user, inc):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    try:
        path, _size = save_upload(file)
    except ValueError as e:
        raise HTTPException(status_code=413, detail=str(e))

    exif = extract_exif(path)
    analysis = analyze_image(path, mime_type=file.content_type or "image/jpeg")

    img = IncidentImage(
        incident_id=incident_id,
        file_path=path,
        original_filename=file.filename,
        mime_type=file.content_type,
        caption=analysis.get("caption"),
        detailed_description=analysis.get("detailed_description"),
        landmarks=analysis.get("landmarks_text"),
        inferred_location=analysis.get("inferred_location"),
        location_reasoning=analysis.get("location_reasoning"),
        motion_analysis=analysis.get("motion_analysis"),
        hazards=analysis.get("hazards_text"),
        confidence=analysis.get("confidence"),
        gps_lat=exif["gps_lat"],
        gps_lon=exif["gps_lon"],
        captured_at=exif["captured_at"],
    )
    db.add(img)

    # Update incident location: prefer EXIF GPS over inference
    updated = False
    if exif["gps_lat"] is not None and exif["gps_lon"] is not None:
        inc.last_lat = exif["gps_lat"]
        inc.last_lon = exif["gps_lon"]
        inc.location_confidence = "exif"
        updated = True
    if analysis.get("inferred_location"):
        inc.inferred_location_name = analysis["inferred_location"]
        if not updated:
            inc.location_confidence = "inferred"

    db.commit()
    db.refresh(img)
    return img


# ------- messages -------

@router.post("/{incident_id}/messages", response_model=IncidentMessageOut)
def post_message(
    incident_id: int,
    payload: IncidentMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not _can_view(user, inc):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Empty message")

    result = translate_message(payload.text)

    msg = IncidentMessage(
        incident_id=incident_id,
        original_text=payload.text,
        detected_language=result.get("detected_language"),
        translated_text=result.get("translated_text"),
        cleaned_text=result.get("cleaned_text"),
        extracted_intent=result.get("extracted_intent"),
        urgency=result.get("urgency"),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
