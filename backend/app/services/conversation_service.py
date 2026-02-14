import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.exceptions import BadRequest, Forbidden, NotFound
from backend.app.models.conversation import Conversation, ConversationMember
from backend.app.models.user import User


async def create_conversation(
    db: AsyncSession,
    creator: User,
    conv_type: str,
    member_ids: list[uuid.UUID],
    name: str | None = None,
) -> Conversation:
    if conv_type not in ("dm", "group"):
        raise BadRequest("Type must be 'dm' or 'group'")

    all_member_ids = list(set(member_ids) | {creator.id})

    if conv_type == "dm" and len(all_member_ids) != 2:
        raise BadRequest("DM must have exactly 2 members")

    # Verify all members are from the same school
    result = await db.execute(select(User).where(User.id.in_(all_member_ids)))
    users = list(result.scalars().all())
    if len(users) != len(all_member_ids):
        raise BadRequest("One or more users not found")
    if any(u.school_id != creator.school_id for u in users):
        raise BadRequest("All members must be from the same school")

    # For DMs, check if one already exists between these two users
    if conv_type == "dm":
        other_id = [mid for mid in all_member_ids if mid != creator.id][0]
        existing = await _find_existing_dm(db, creator.id, other_id)
        if existing:
            return existing

    conv = Conversation(
        type=conv_type,
        name=name,
        school_id=creator.school_id,
        created_by=creator.id,
    )
    db.add(conv)
    await db.flush()

    for uid in all_member_ids:
        db.add(ConversationMember(conversation_id=conv.id, user_id=uid))

    await db.commit()
    return await get_conversation(db, conv.id)


async def _find_existing_dm(db: AsyncSession, user1_id: uuid.UUID, user2_id: uuid.UUID) -> Conversation | None:
    stmt = (
        select(Conversation)
        .join(ConversationMember)
        .where(Conversation.type == "dm")
        .where(ConversationMember.user_id.in_([user1_id, user2_id]))
        .group_by(Conversation.id)
        .options(selectinload(Conversation.members))
    )
    result = await db.execute(stmt)
    for conv in result.scalars().all():
        member_ids = {m.user_id for m in conv.members}
        if member_ids == {user1_id, user2_id}:
            return conv
    return None


async def get_conversations(db: AsyncSession, user_id: uuid.UUID) -> list[Conversation]:
    stmt = (
        select(Conversation)
        .join(ConversationMember)
        .where(ConversationMember.user_id == user_id)
        .options(selectinload(Conversation.members))
        .order_by(Conversation.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    stmt = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.members))
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise NotFound("Conversation not found")
    return conv


async def add_member(db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID, requester: User) -> None:
    conv = await get_conversation(db, conversation_id)
    if conv.type == "dm":
        raise BadRequest("Cannot add members to a DM")
    if requester.id != conv.created_by:
        raise Forbidden("Only the creator can add members")

    target = await db.execute(select(User).where(User.id == user_id))
    target_user = target.scalar_one_or_none()
    if not target_user or target_user.school_id != conv.school_id:
        raise BadRequest("User not found or from a different school")

    existing = [m for m in conv.members if m.user_id == user_id]
    if existing:
        raise BadRequest("User is already a member")

    db.add(ConversationMember(conversation_id=conversation_id, user_id=user_id))
    await db.commit()


async def remove_member(db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID, requester: User) -> None:
    conv = await get_conversation(db, conversation_id)
    if conv.type == "dm":
        raise BadRequest("Cannot remove members from a DM")
    if requester.id != conv.created_by and requester.id != user_id:
        raise Forbidden("Only the creator or the member themselves can remove")

    member = next((m for m in conv.members if m.user_id == user_id), None)
    if not member:
        raise NotFound("Member not found")

    await db.delete(member)
    await db.commit()
