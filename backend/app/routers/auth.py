import time
from collections import defaultdict

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.exceptions import BadRequest
from backend.app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    VerifyRequest,
)
from backend.app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

# Simple in-memory rate limiter: IP -> list of timestamps
_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 10  # requests per window


def _check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    # Clean old entries
    _rate_limits[ip] = [t for t in _rate_limits[ip] if t > window_start]
    if len(_rate_limits[ip]) >= RATE_LIMIT_MAX:
        raise BadRequest("Too many requests. Please try again later.")
    _rate_limits[ip].append(now)


@router.post("/signup", response_model=MessageResponse)
async def signup(body: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(request)
    await auth_service.signup(db, body.email, body.password, body.display_name)
    return {"message": "Verification code sent to your email"}


@router.post("/verify", response_model=TokenResponse)
async def verify(body: VerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(request)
    tokens = await auth_service.verify_email(db, body.email, body.code)
    return TokenResponse(**tokens)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(request)
    tokens = await auth_service.login(db, body.email, body.password)
    return TokenResponse(**tokens)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    tokens = await auth_service.refresh_tokens(db, body.refresh_token)
    return TokenResponse(**tokens)
