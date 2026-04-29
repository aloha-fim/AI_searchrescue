# Search & Rescue Console

A full-stack app that helps people in distress send rich SOS reports — photos,
GPS, and free-form messages — and helps rescuers (helicopter pilots, rescue
swimmers, watchstanders) act on them. Photos are auto-captioned and analyzed
for landmarks, likely location, motion, and hazards. Free-form text from
victims is auto-translated and cleaned up to professional dispatch English.
A separate page tracks supplies before, during, and after each rescue.

```
┌────────────────┐    ┌────────────────────────┐    ┌────────────┐
│ React (Vite)   │ ←→ │ FastAPI                │ ←→ │ PostgreSQL │
│ - Victim app   │    │ - Auth (JWT)           │    └────────────┘
│ - Dispatch UI  │    │ - Incidents / images   │
│ - Supplies UI  │    │ - Translation          │            ┌──────────────┐
└────────────────┘    │ - Vision analysis ─────┼──────────► │ Anthropic API│
                      │ - Supplies & txns      │            └──────────────┘
                      └────────────────────────┘
```

## Stack

- **Backend:** FastAPI, SQLAlchemy 2, Pydantic v2, JWT auth, Anthropic SDK
- **DB:** PostgreSQL 16
- **Frontend:** React 18 + Vite + react-router-dom
- **Deploy:** docker-compose for local dev

## Quick start (Docker)

```bash
cd sar-app
cp backend/.env.example backend/.env
# edit backend/.env and set ANTHROPIC_API_KEY=sk-ant-...
docker compose up --build
```

Then visit:

- Frontend: http://localhost:5173
- Backend OpenAPI docs: http://localhost:8000/docs

The backend auto-creates tables and seeds a starter set of supplies on first
boot.

## Quick start (without Docker)

```bash
# Postgres must be running locally on :5432 with db/user/pass = sar/sar/sar.

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit ANTHROPIC_API_KEY
uvicorn app.main:app --reload

# in another terminal
cd frontend
npm install
npm run dev
```

## Roles

When you register, pick a role:

- **victim** — can create one incident, upload photos, send messages
- **pilot / swimmer / watchstander** — can view all incidents and act on them
- **watchstander / admin** — can also create new supply items
- **admin** — can delete supplies

JWTs are signed with `SECRET_KEY` from `.env`. Rotate it for production.

## Vision analysis

When a photo is uploaded the backend:

1. Saves the file under `UPLOAD_DIR`.
2. Reads EXIF metadata (GPS lat/lon and capture time) using `exifread`.
3. Sends the image to Anthropic with a strict-JSON prompt asking for:
   caption, detailed description, landmarks, inferred location +
   confidence + reasoning, motion analysis, hazards.
4. Stores all of it on the `IncidentImage` row.
5. Updates the incident's last known location: prefers EXIF GPS, falls
   back to the model's inferred location.

## Translation

When a message is posted the backend asks the model to return JSON with:

- `detected_language`
- `translated_text` (full English translation)
- `cleaned_text` (clean dispatch English)
- `extracted_intent` (what they need)
- `urgency` (low / medium / high / critical)

This lets a panicked, broken, or non-English message become a clear single
line that a watchstander can read aloud, while the original is kept for
the record.

## Supplies

The `/supplies` page tracks inventory by category (medical, fuel, food,
water, gear, comms). Every change is recorded as a `SupplyTransaction`
with a `phase` field (`pre`, `during`, `post`) so you can audit what was
deployed for which incident and what was restocked afterward. Items
whose quantity falls at or below their `minimum_quantity` are flagged
LOW and can be filtered.

## API surface

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/incidents
POST   /api/incidents
GET    /api/incidents/{id}
PATCH  /api/incidents/{id}
POST   /api/incidents/{id}/images        (multipart/form-data, field: file)
POST   /api/incidents/{id}/messages      ({ "text": "..." })

GET    /api/images/{image_id}            (auth-protected file)

GET    /api/supplies?category=&low_stock_only=
POST   /api/supplies
PATCH  /api/supplies/{id}
DELETE /api/supplies/{id}
GET    /api/supplies/{id}/transactions
POST   /api/supplies/{id}/transactions   ({ change, reason, phase, incident_id?, note? })
```

Full schema with examples is at http://localhost:8000/docs.

## Notes for production

- Replace `Base.metadata.create_all` with Alembic migrations.
- Move uploads from local disk to S3 or equivalent.
- Add background workers (RQ / Celery / arq) so vision and translation
  calls don't block the request that uploaded the photo or posted the
  message — for an actual SAR system the request should return
  immediately and analysis should stream in.
- Add WebSockets / SSE for live dashboard updates instead of the 8s
  polling used here.
- Tighten CORS, add rate limiting, audit logging, and field-level
  encryption for personally identifying data.
