"""'Ask the evidence' live answer – Cloud Run service.

The browser computes every count from the frozen dataset and sends only those counts, the nearest
tests and up to five reviewed passages. The model writes a short English answer from them; every
number in the answer is checked against that context (number_guard) before it is returned.

Model: Gemini (Google AI Studio free tier – a standing Space Apps Global Offer, not the $300 trial
credit, so no billing is involved). The API key is read from GEMINI_API_KEY, set on the Cloud Run
service from Secret Manager; it is never written to a file in this repo and never logged.
The question text is never logged.
"""
import json
import os
import re
import time
from collections import defaultdict, deque
from pathlib import Path

from google import genai
from google.genai import errors as genai_errors
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from number_guard import guard

MODEL = os.environ.get("MODEL", "gemini-3.8-flash")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://semanurcetinn.github.io")
MAX_BODY = 32 * 1024
RATE_PER_MIN = 10
SYSTEM = (Path(__file__).parent / "prompt.md").read_text(encoding="utf-8")

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "citations": {"type": "array", "items": {"type": "string"}},
        "caveats": {"type": "array", "items": {"type": "string"}},
        "cannot_answer": {"type": "boolean"},
    },
    "required": ["answer", "citations", "caveats", "cannot_answer"],
}

# Reads GEMINI_API_KEY from the environment; raises at startup if it is missing, rather than
# failing silently on the first request.
if not os.environ.get("GEMINI_API_KEY"):
    raise RuntimeError("GEMINI_API_KEY is not set (expected from a Secret Manager binding)")
client = genai.Client()

app = FastAPI(title="Moon Fire Evidence Map – ask")
app.add_middleware(CORSMiddleware, allow_origins=[ALLOWED_ORIGIN], allow_methods=["POST", "GET"], allow_headers=["Content-Type"])
_hits = defaultdict(deque)
_JSON_RE = re.compile(r"\{.*\}", re.S)  # the model may wrap JSON in prose or a code fence despite response_format


class AskBody(BaseModel):
    question: str = Field(max_length=300)
    counts: dict = Field(default_factory=dict)
    nearest: dict = Field(default_factory=dict)
    notes: list = Field(default_factory=list)
    passages: list = Field(default_factory=list, max_length=5)


def _rate_limited(ip):
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_PER_MIN:
        return True
    q.append(now)
    return False


def _empty(reason):
    return {"answer": "", "citations": [], "caveats": [], "cannot_answer": True, "checked": False, "reason": reason}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ask")
async def ask(request: Request):
    raw = await request.body()
    if len(raw) > MAX_BODY:
        raise HTTPException(413, "body too large")
    origin = request.headers.get("origin")
    if origin and origin != ALLOWED_ORIGIN:
        raise HTTPException(403, "origin not allowed")
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    if _rate_limited(ip):
        raise HTTPException(429, "too many requests")
    try:
        body = AskBody.model_validate_json(raw)
    except Exception:
        raise HTTPException(400, "invalid body")

    context = {"counts": body.counts, "nearest": body.nearest, "notes": body.notes, "passages": body.passages}
    user = "Question: " + body.question + "\n\nRetrieval result (JSON):\n" + json.dumps(context, ensure_ascii=False)
    try:
        interaction = client.interactions.create(
            model=MODEL,
            system_instruction=SYSTEM,
            input=user,
            response_format={"type": "text", "mime_type": "application/json", "schema": ANSWER_SCHEMA},
            generation_config={"max_output_tokens": 800},
        )
    except genai_errors.ClientError as e:
        # 429 = rate_limited; other 4xx = our own request shape, not the user's fault.
        return _empty("rate_limited" if getattr(e, "code", None) == 429 else "client_error")
    except genai_errors.ServerError:
        return _empty("server_error")
    except Exception:
        return _empty("connection_error")

    text = getattr(interaction, "output_text", "") or ""
    if not text.strip():
        return _empty("blocked_or_empty")
    m = _JSON_RE.search(text)
    try:
        out = json.loads(m.group(0) if m else text)
    except json.JSONDecodeError:
        return _empty("unparseable")

    clean, checked, removed = guard(out.get("answer", ""), context)
    caveats = [c for c in out.get("caveats", []) if guard(c, context)[1]]
    return {
        "answer": clean,
        "citations": [c for c in out.get("citations", []) if isinstance(c, str)][:10],
        "caveats": caveats[:5],
        "cannot_answer": bool(out.get("cannot_answer")) or not clean,
        "checked": checked and bool(clean),
        "removed_sentences": len(removed),
    }
