import base64
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.exceptions import BadRequest, NotFound
from backend.app.models.public_key import PublicKey


def _validate_key(key_b64: str) -> None:
    try:
        raw = base64.b64decode(key_b64)
        if len(raw) != 32:
            raise BadRequest("Public key must be 32 bytes (Curve25519)")
    except Exception:
        raise BadRequest("Invalid base64-encoded public key")


async def publish_key(db: AsyncSession, user_id: uuid.UUID, public_key_b64: str) -> PublicKey:
    _validate_key(public_key_b64)

    # Deactivate any existing active keys
    await db.execute(
        update(PublicKey)
        .where(PublicKey.user_id == user_id, PublicKey.is_active == True)
        .values(is_active=False)
    )

    key = PublicKey(
        user_id=user_id,
        public_key_b64=public_key_b64,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key


async def get_active_key(db: AsyncSession, user_id: uuid.UUID) -> PublicKey:
    result = await db.execute(
        select(PublicKey).where(PublicKey.user_id == user_id, PublicKey.is_active == True)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise NotFound("No active public key for this user")
    return key


async def get_batch_keys(db: AsyncSession, user_ids: list[uuid.UUID]) -> list[PublicKey]:
    result = await db.execute(
        select(PublicKey).where(PublicKey.user_id.in_(user_ids), PublicKey.is_active == True)
    )
    return list(result.scalars().all())
