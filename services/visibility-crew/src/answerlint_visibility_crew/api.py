from __future__ import annotations

import asyncio
import logging

import uvicorn
from fastapi import FastAPI, Header, HTTPException, Request, status
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .flow import run_analysis
from .schemas import AnalysisRequest, AnalysisResponse
from .security import AuthenticationError, ReplayGuard, verify_signature
from .settings import get_settings


settings = get_settings()
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("answerlint.visibility_crew")
app = FastAPI(
    title="AnswerLint Visibility Crew",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))
capacity = asyncio.Semaphore(settings.max_concurrency)
replay_guard = ReplayGuard()


async def read_bounded_body(request: Request, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE)
        chunks.append(chunk)
    return b"".join(chunks)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "answerlint-visibility-crew"}


@app.post("/v1/analyze", response_model=AnalysisResponse)
async def analyze(
    request: Request,
    x_answerlint_timestamp: str | None = Header(default=None),
    x_answerlint_request_id: str | None = Header(default=None),
    x_answerlint_signature: str | None = Header(default=None),
    x_answerlint_key_id: str | None = Header(default=None),
) -> AnalysisResponse:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.max_body_bytes:
                raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid content length",
            ) from error
    body = await read_bounded_body(request, settings.max_body_bytes)
    if x_answerlint_key_id != settings.key_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown key")
    try:
        verify_signature(
            secret=settings.signing_secret,
            timestamp=x_answerlint_timestamp,
            request_id=x_answerlint_request_id,
            signature=x_answerlint_signature,
            body=body,
            ttl_seconds=settings.signature_ttl_seconds,
        )
        replay_guard.claim(
            x_answerlint_request_id or "",
            int(x_answerlint_timestamp or "0") + settings.signature_ttl_seconds,
        )
    except AuthenticationError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error

    try:
        payload = AnalysisRequest.model_validate_json(body)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    async with capacity:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(run_analysis, payload, settings),
                timeout=settings.request_timeout_seconds,
            )
        except TimeoutError as error:
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT) from error
        except ValueError:
            logger.warning("Crew analysis rejected for project %s", payload.project_id)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Crew output failed evidence validation",
            ) from error
        except Exception as error:
            logger.exception("Crew analysis failed for project %s", payload.project_id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Crew analysis failed",
            ) from error


def run() -> None:
    uvicorn.run(
        "answerlint_visibility_crew.api:app",
        host="0.0.0.0",
        port=8010,
        log_level=settings.log_level.lower(),
    )
