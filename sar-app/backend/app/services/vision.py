"""
Vision analysis: image captioning, landmark identification, inferred location,
motion analysis, and hazard detection.

Uses Anthropic's vision-capable models. The model is asked to return a strict
JSON object so the backend can store structured fields.

If ANTHROPIC_API_KEY is not configured, returns a benign placeholder so the
rest of the app keeps working in dev.
"""
import base64
import json
import logging
import re
from pathlib import Path
from typing import Optional

from anthropic import Anthropic

from ..config import settings

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an analyst supporting search-and-rescue operations.
A person in distress has uploaded a photo. Analyze the image and respond with
ONLY a JSON object — no prose, no markdown fences. Keys:

{
  "caption": "<one short sentence>",
  "detailed_description": "<2-4 sentences: what is happening, environment, weather, time of day>",
  "landmarks": ["<notable natural or man-made landmarks visible>"],
  "inferred_location": "<best guess at region/island/coastline; null if unclear>",
  "location_reasoning": "<why you think so: vegetation, geology, signage, etc.>",
  "motion_analysis": "<is the subject moving, drifting, sinking, swimming, waving, still>",
  "hazards": ["<hazards visible: fire, flooding, sinking vessel, injury, predators, exposure>"],
  "confidence": <0..1 float for the location guess>
}

Be honest about uncertainty. If you cannot identify the location, set
inferred_location to null and confidence near 0. Never invent coordinates.
"""

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _extract_json(text: str) -> dict:
    cleaned = _FENCE_RE.sub("", text).strip()
    # find first { ... last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in: {text[:200]}")
    return json.loads(cleaned[start : end + 1])


def _placeholder_result() -> dict:
    return {
        "caption": "(vision analysis disabled — no ANTHROPIC_API_KEY configured)",
        "detailed_description": "",
        "landmarks": [],
        "inferred_location": None,
        "location_reasoning": "",
        "motion_analysis": "",
        "hazards": [],
        "confidence": 0.0,
    }


def analyze_image(file_path: str, mime_type: str = "image/jpeg") -> dict:
    if not settings.ANTHROPIC_API_KEY:
        log.warning("ANTHROPIC_API_KEY not set; returning placeholder analysis.")
        return _placeholder_result()

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(file_path)

    img_b64 = base64.standard_b64encode(path.read_bytes()).decode("ascii")

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=settings.VISION_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type or "image/jpeg",
                            "data": img_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Analyze this photo from a person in distress. Return JSON only.",
                    },
                ],
            }
        ],
    )

    text = "".join(block.text for block in msg.content if block.type == "text")
    try:
        data = _extract_json(text)
    except Exception as e:
        log.exception("Failed to parse vision JSON")
        return {**_placeholder_result(), "caption": "Analysis failed", "detailed_description": str(e)}

    # Normalize types
    if isinstance(data.get("landmarks"), list):
        data["landmarks_text"] = ", ".join(str(x) for x in data["landmarks"])
    else:
        data["landmarks_text"] = str(data.get("landmarks") or "")

    if isinstance(data.get("hazards"), list):
        data["hazards_text"] = ", ".join(str(x) for x in data["hazards"])
    else:
        data["hazards_text"] = str(data.get("hazards") or "")

    try:
        data["confidence"] = float(data.get("confidence") or 0.0)
    except (TypeError, ValueError):
        data["confidence"] = 0.0

    return data
