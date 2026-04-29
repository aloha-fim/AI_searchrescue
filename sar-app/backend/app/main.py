import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from .models import IncidentImage, SupplyItem
from .routers import auth as auth_router
from .routers import incidents as incidents_router
from .routers import supplies as supplies_router
from .auth import get_current_user

app = FastAPI(title="Search & Rescue API", version="0.1.0")

origins = [o.strip() for o in settings.FRONTEND_ORIGIN.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(incidents_router.router)
app.include_router(supplies_router.router)


@app.on_event("startup")
def on_startup():
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    # Auto-create tables for dev. In production use Alembic migrations.
    Base.metadata.create_all(bind=engine)
    _seed_supplies()


def _seed_supplies():
    """Seed a few default supplies on first run."""
    from .database import SessionLocal
    db: Session = SessionLocal()
    try:
        if db.query(SupplyItem).count() > 0:
            return
        defaults = [
            SupplyItem(name="Life raft (10-person)", category="gear", unit="each", quantity=8, minimum_quantity=4),
            SupplyItem(name="Rescue swimmer fins", category="gear", unit="pair", quantity=12, minimum_quantity=6),
            SupplyItem(name="Medical kit (trauma)", category="medical", unit="kit", quantity=20, minimum_quantity=10),
            SupplyItem(name="Saline IV bag", category="medical", unit="bag", quantity=60, minimum_quantity=30),
            SupplyItem(name="Helicopter fuel (Jet A)", category="fuel", unit="gallon", quantity=4000, minimum_quantity=2000, location="Apron 1"),
            SupplyItem(name="Drinking water (1L)", category="water", unit="bottle", quantity=300, minimum_quantity=120),
            SupplyItem(name="Emergency rations (24h)", category="food", unit="ration", quantity=150, minimum_quantity=60),
            SupplyItem(name="VHF handheld radio", category="comms", unit="each", quantity=18, minimum_quantity=10),
            SupplyItem(name="Thermal blanket", category="gear", unit="each", quantity=200, minimum_quantity=80),
            SupplyItem(name="Personal locator beacon", category="gear", unit="each", quantity=25, minimum_quantity=15),
        ]
        db.add_all(defaults)
        db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/images/{image_id}")
def get_image(
    image_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    img = db.query(IncidentImage).filter(IncidentImage.id == image_id).first()
    if not img or not os.path.exists(img.file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(img.file_path, media_type=img.mime_type or "image/jpeg")
