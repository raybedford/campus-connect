import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.exceptions import BadRequest, Conflict, Unauthorized
from backend.app.models.user import School, User
from backend.app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from backend.app.services.email_service import send_verification_email
from backend.app.config import settings


def _extract_edu_domain(email: str) -> str:
    domain = email.split("@")[1].lower()
    if not domain.endswith(".edu"):
        raise BadRequest("Only .edu email addresses are allowed")
    return domain


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


async def signup(db: AsyncSession, email: str, password: str, display_name: str) -> None:
    domain = _extract_edu_domain(email)

    existing = await db.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none():
        raise Conflict("An account with this email already exists")

    # Find or create school
    result = await db.execute(select(School).where(School.domain == domain))
    school = result.scalar_one_or_none()
    if not school:
        school = School(domain=domain)
        db.add(school)
        await db.flush()

    code = _generate_code()
    user = User(
        email=email.lower(),
        display_name=display_name,
        password_hash=hash_password(password),
        school_id=school.id,
        verification_code=code,
        verification_expires=datetime.now(timezone.utc) + timedelta(minutes=settings.verification_code_expire_minutes),
    )
    db.add(user)
    await db.commit()
    await send_verification_email(email, code)


async def verify_email(db: AsyncSession, email: str, code: str) -> dict:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if not user:
        raise BadRequest("Invalid email or code")
    if user.is_verified:
        raise BadRequest("Email already verified")
    if user.verification_code != code:
        raise BadRequest("Invalid email or code")
    if user.verification_expires and user.verification_expires < datetime.now(timezone.utc):
        raise BadRequest("Verification code expired")

    user.is_verified = True
    user.verification_code = None
    user.verification_expires = None
    await db.commit()

    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
    }


async def login(db: AsyncSession, email: str, password: str) -> dict:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise Unauthorized("Invalid email or password")
    if not user.is_verified:
        raise BadRequest("Email not verified")

    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
    }


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> dict:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise Unauthorized("Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise Unauthorized("Invalid refresh token")

    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
    }
