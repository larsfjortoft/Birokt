#!/usr/bin/env python3
import asyncio
import base64
import json
import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from aiohttp import ClientSession, web
import edge_tts

HERMES_AGENT_DIR = Path(os.getenv("HERMES_AGENT_DIR", "/home/lars/.hermes/hermes-agent"))
if HERMES_AGENT_DIR.exists():
    sys.path.insert(0, str(HERMES_AGENT_DIR))

from tools.transcription_tools import (  # noqa: E402
    _extract_transcript_text,
    _resolve_openai_audio_client_config,
)

LOG = logging.getLogger("birokt-voice-proxy")

HOST = os.getenv("BIROKT_VOICE_HOST", "0.0.0.0")
PORT = int(os.getenv("BIROKT_VOICE_PORT", "9100"))
HERMES_API_URL = os.getenv("HERMES_API_URL", "http://127.0.0.1:8642/v1/chat/completions")
HERMES_API_KEY = os.getenv("HERMES_API_KEY", "")
HERMES_MODEL = os.getenv("HERMES_MODEL", "hermes-agent")
OPENAI_TRANSCRIBE_MODEL = os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe")
OPENAI_TRANSCRIBE_LANGUAGE = os.getenv("OPENAI_TRANSCRIBE_LANGUAGE", "no")
EDGE_TTS_VOICE = os.getenv("EDGE_TTS_VOICE", "nb-NO-FinnNeural")
MAX_UPLOAD_BYTES = int(os.getenv("BIROKT_VOICE_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))


def _json_error(message: str, status: int = 400) -> web.Response:
    return web.json_response({"error": message}, status=status)


async def health(_: web.Request) -> web.Response:
    return web.json_response(
        {
            "status": "ok",
            "service": "birokt-voice-proxy",
            "hermesApiUrl": HERMES_API_URL,
        }
    )


async def _read_multipart(request: web.Request) -> tuple[Path, dict[str, Any]]:
    reader = await request.multipart()
    context: dict[str, Any] = {}
    audio_path: Path | None = None

    async for part in reader:
        if part.name == "context":
            raw = await part.text()
            context = json.loads(raw) if raw else {}
            continue

        if part.name != "audio":
            continue

        suffix = Path(part.filename or "field.m4a").suffix or ".m4a"
        fd, tmp_name = tempfile.mkstemp(prefix="birokt-field-", suffix=suffix)
        size = 0
        with os.fdopen(fd, "wb") as out:
            while True:
                chunk = await part.read_chunk()
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise web.HTTPRequestEntityTooLarge(
                        max_size=MAX_UPLOAD_BYTES,
                        actual_size=size,
                    )
                out.write(chunk)
        audio_path = Path(tmp_name)

    if audio_path is None:
        raise ValueError("Mangler audio-felt i foresporselen.")

    return audio_path, context


async def _transcribe(path: Path) -> str:
    return await asyncio.to_thread(_transcribe_openai, path)


def _transcribe_openai(path: Path) -> str:
    from openai import OpenAI

    api_key, base_url = _resolve_openai_audio_client_config()
    client = OpenAI(api_key=api_key, base_url=base_url, timeout=60, max_retries=1)
    try:
        with path.open("rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model=OPENAI_TRANSCRIBE_MODEL,
                file=audio_file,
                language=OPENAI_TRANSCRIBE_LANGUAGE,
                response_format="json",
            )

        transcript = _extract_transcript_text(transcription)
        LOG.info(
            "Transcribed %s via OpenAI API (%s, language=%s, %d chars)",
            path.name,
            OPENAI_TRANSCRIBE_MODEL,
            OPENAI_TRANSCRIBE_LANGUAGE,
            len(transcript),
        )
        return transcript
    finally:
        close = getattr(client, "close", None)
        if callable(close):
            close()


def _build_prompt(transcript: str, context: dict[str, Any]) -> str:
    apiary = context.get("apiaryName")
    prefix = "[Feltmodus, Birokt]"
    if apiary:
        prefix = f"{prefix} [Bigard: {apiary}]"

    return (
        f"{prefix}\n"
        "Dette er handfri tale fra bigarden. Tolke korte notater praktisk, "
        "bruk Birokt-skillen og Birokt API ved behov, og svar kort pa norsk.\n\n"
        f"Bruker sa: {transcript}"
    )


async def _ask_hermes(prompt: str, session_id: str) -> tuple[str, str]:
    headers = {"Content-Type": "application/json"}
    if HERMES_API_KEY:
        headers["Authorization"] = f"Bearer {HERMES_API_KEY}"
        headers["X-Hermes-Session-Id"] = session_id

    payload = {
        "model": HERMES_MODEL,
        "stream": False,
        "messages": [{"role": "user", "content": prompt}],
    }

    async with ClientSession() as session:
        async with session.post(HERMES_API_URL, headers=headers, json=payload, timeout=180) as response:
            data = await response.json()
            if response.status >= 400:
                raise RuntimeError(data.get("error", {}).get("message") or f"Hermes svarte {response.status}.")

            reply = data["choices"][0]["message"]["content"].strip()
            returned_session_id = response.headers.get("X-Hermes-Session-Id", session_id)
            return reply, returned_session_id


async def _tts_base64(text: str) -> tuple[str, str]:
    fd, tmp_name = tempfile.mkstemp(prefix="birokt-reply-", suffix=".mp3")
    os.close(fd)
    path = Path(tmp_name)
    try:
        communicate = edge_tts.Communicate(text, EDGE_TTS_VOICE)
        await communicate.save(str(path))
        return base64.b64encode(path.read_bytes()).decode("ascii"), "audio/mpeg"
    finally:
        path.unlink(missing_ok=True)


async def voice(request: web.Request) -> web.Response:
    audio_path: Path | None = None
    try:
        audio_path, context = await _read_multipart(request)
        session_id = str(context.get("sessionId") or "birokt-field")
        transcript = await _transcribe(audio_path)

        if not transcript:
            return _json_error("Jeg horte ikke noe tydelig tale i lydklippet.", 422)

        reply_text, session_id = await _ask_hermes(_build_prompt(transcript, context), session_id)
        reply_audio, reply_mime = await _tts_base64(reply_text)

        return web.json_response(
            {
                "transcript": transcript,
                "replyText": reply_text,
                "replyAudioBase64": reply_audio,
                "replyAudioMime": reply_mime,
                "sessionId": session_id,
            }
        )
    except web.HTTPException:
        raise
    except Exception as exc:
        LOG.exception("Voice request failed")
        return _json_error(str(exc), 500)
    finally:
        if audio_path:
            audio_path.unlink(missing_ok=True)


def create_app() -> web.Application:
    app = web.Application(client_max_size=MAX_UPLOAD_BYTES)
    app.router.add_get("/health", health)
    app.router.add_post("/voice", voice)
    return app


if __name__ == "__main__":
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    web.run_app(create_app(), host=HOST, port=PORT)
