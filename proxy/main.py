"""'Ask the evidence' live answer – Cloud Run service.

The browser computes every count from the frozen dataset and sends only those counts, the nearest
tests and up to five reviewed passages. The model writes a short English answer from them; every
number in the answer is checked against that context (number_guard) before it is returned.
No API key: Vertex AI is reached with the Cloud Run service account (roles/aiplatform.user).
The question text is never logged.
"""
import json
import os
import time
from collections import defaultdict, deque
from pathlib import Path

import anthropic
from anthropic import AnthropicVertex, BetaFallbackState, BetaRefusalFallbackMiddleware
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from number_guard import guard

PROJECT = os.environ.get("GCP_PROJECT", "")
REGION = os.environ.get("GCP_REGION", "global")
MODEL = os.environ.get("MODEL", "claude-opus-5-5")
FALLBACK_MODEL = os.environ.get("FALLBACK_MODEL", "claude-opus-4-8")   # "" disables the refusal fallback
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
    "additionalProperties": False,
}

middleware = [BetaRefusalFallbackMiddleware([{"model": FALLBACK_MODEL}])] if FALLBACK_MODEL else []
client = AnthropicVertex(project_id=PROJECT or None, region=REGION, middleware=middleware, timeout=20.0, max_retries=1)

app = FastAPI(title="Moon Fire Evidence Map – ask")
app.add_middleware(CORSMiddleware, allow_origins=[ALLOWED_ORIGIN], allow_methods=["POST", "GET"], allow_headers=["Content-Type"])
_hits = defaultdict(deque)


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
        with BetaFallbackState():
            msg = client.beta.messages.create(
                model=MODEL,
                max_tokens=4000,
                system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
                messages=[{"role": "user", "content": user}],
            )
    except anthropic.RateLimitError:
        return _empty("rate_limited")
    except anthropic.APIStatusError as e:
        return _empty(f"api_error_{e.status_code}")
    except anthropic.APIConnectionError:
        return _empty("connection_error")

    if msg.stop_reason == "refusal":
        return _empty("refusal")
    if msg.stop_reason == "max_tokens":
        return _empty("truncated")
    text = next((b.text for b in msg.content if b.type == "text"), "")
    try:
        out = json.loads(text)
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
