import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.key import PublicKeyOut, PublishKeyRequest
from backend.app.services import key_service

router = APIRouter(prefix="/keys", tags=["keys"])


@router.post("/publish", response_model=PublicKeyOut)
async def publish(
    body: PublishKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await key_service.publish_key(db, current_user.id, body.public_key_b64)


@router.get("/{user_id}", response_model=PublicKeyOut)
async def get_key(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await key_service.get_active_key(db, user_id)


@router.get("/batch/", response_model=list[PublicKeyOut])
async def get_batch(
    user_ids: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = [uuid.UUID(uid.strip()) for uid in user_ids.split(",") if uid.strip()]
    return await key_service.get_batch_keys(db, ids)
