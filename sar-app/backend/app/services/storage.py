"""File storage + EXIF GPS extraction utilities."""
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import exifread
from fastapi import UploadFile

from ..config import settings


def save_upload(file: UploadFile) -> Tuple[str, int]:
    """Save the uploaded file under UPLOAD_DIR. Returns (absolute_path, size_bytes)."""
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix or ".bin"
    name = f"{uuid.uuid4().hex}{suffix}"
    full = Path(settings.UPLOAD_DIR) / name

    size = 0
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    with full.open("wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                out.close()
                full.unlink(missing_ok=True)
                raise ValueError(f"File too large (>{settings.MAX_UPLOAD_MB} MB)")
            out.write(chunk)
    return str(full), size


def _ratio_to_float(ratio) -> float:
    return float(ratio.num) / float(ratio.den) if ratio.den else 0.0


def _dms_to_decimal(dms, ref: str) -> float:
    d, m, s = [_ratio_to_float(v) for v in dms.values]
    decimal = d + (m / 60.0) + (s / 3600.0)
    if ref in ("S", "W"):
        decimal = -decimal
    return decimal


def extract_exif(file_path: str) -> dict:
    """Extract GPS lat/lon and capture timestamp from an image file (best-effort)."""
    out: dict = {"gps_lat": None, "gps_lon": None, "captured_at": None}
    try:
        with open(file_path, "rb") as f:
            tags = exifread.process_file(f, details=False)
    except Exception:
        return out

    try:
        lat = tags.get("GPS GPSLatitude")
        lat_ref = tags.get("GPS GPSLatitudeRef")
        lon = tags.get("GPS GPSLongitude")
        lon_ref = tags.get("GPS GPSLongitudeRef")
        if lat and lon and lat_ref and lon_ref:
            out["gps_lat"] = _dms_to_decimal(lat, str(lat_ref))
            out["gps_lon"] = _dms_to_decimal(lon, str(lon_ref))
    except Exception:
        pass

    try:
        dt = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
        if dt:
            out["captured_at"] = datetime.strptime(str(dt), "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass

    return out
