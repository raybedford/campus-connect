import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.exceptions import BadRequest, Forbidden
from backend.app.models.conversation import ConversationMember
from backend.app.models.message import Message


async def create_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
    message_type: str,
    encrypted_payloads: list[dict],
) -> Message:
    # Verify sender is a member
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == sender_id,
        )
    )
    if not result.scalar_one_or_none():
        raise Forbidden("Not a member of this conversation")

    if message_type not in ("text", "file"):
        raise BadRequest("Invalid message type")

    msg = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        message_type=message_type,
        encrypted_payloads=encrypted_payloads,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    before: datetime | None = None,
    limit: int = 50,
) -> list[Message]:
    # Verify membership
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise Forbidden("Not a member of this conversation")

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    if before:
        stmt = stmt.where(Message.created_at < before)

    result = await db.execute(stmt)
    messages = list(result.scalars().all())
    messages.reverse()  # Return in chronological order
    return messages
