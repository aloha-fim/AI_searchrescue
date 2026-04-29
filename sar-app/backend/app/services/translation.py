"""
Translation + intent extraction.

Takes a (possibly broken / non-English / panicked) message from a victim and
returns:
  - detected_language
  - translated_text   (full translation to English if needed)
  - cleaned_text      (clean understandable English version)
  - extracted_intent  (what the person is asking for / their situation)
  - urgency           (low / medium / high / critical)
"""
import json
import logging
import re
from anthropic import Anthropic

from ..config import settings

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a translator and dispatcher for search-and-rescue.
A person in distress sent a message. They may be writing in broken English, a
non-English language, or a panicked stream of words. Respond with ONLY a JSON
object (no prose, no markdown fences) with keys:

{
  "detected_language": "<ISO name, e.g. English, Tagalog, Spanish>",
  "translated_text": "<full English translation>",
  "cleaned_text": "<short, clear, professional English summary a watchstander can read aloud>",
  "extracted_intent": "<what they need / their situation, in one or two sentences>",
  "urgency": "<low | medium | high | critical>"
}

Preserve any specific facts: numbers of people, injuries, vessel names,
landmarks, time references. If the message is empty or meaningless, set urgency
to "low" and explain in extracted_intent.
"""

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _extract_json(text: str) -> dict:
    cleaned = _FENCE_RE.sub("", text).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in: {text[:200]}")
    return json.loads(cleaned[start : end + 1])


def _placeholder(text: str) -> dict:
    return {
        "detected_language": "unknown",
        "translated_text": text,
        "cleaned_text": text,
        "extracted_intent": "(translation disabled — no ANTHROPIC_API_KEY configured)",
        "urgency": "medium",
    }


def translate_message(text: str) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        return _placeholder(text)

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=settings.VISION_MODEL,
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": text}],
    )
    raw = "".join(block.text for block in msg.content if block.type == "text")
    try:
        data = _extract_json(raw)
    except Exception:
        log.exception("Failed to parse translation JSON")
        return _placeholder(text)

    urgency = str(data.get("urgency", "medium")).lower()
    if urgency not in {"low", "medium", "high", "critical"}:
        urgency = "medium"
    data["urgency"] = urgency
    return data
