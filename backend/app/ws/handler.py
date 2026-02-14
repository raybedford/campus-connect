import json
import logging
import uuid

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select

from backend.app.database import async_session
from backend.app.models.conversation import ConversationMember
from backend.app.models.user import User
from backend.app.security import decode_token
from backend.app.services.message_service import create_message
from backend.app.ws.connection_manager import manager

logger = logging.getLogger(__name__)


async def _authenticate_ws(ws: WebSocket) -> User | None:
    token = ws.query_params.get("token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None
    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


async def _get_user_conversation_member_ids(user_id: uuid.UUID) -> dict[uuid.UUID, list[uuid.UUID]]:
    """Get all conversations for a user and their member IDs."""
    async with async_session() as db:
        # Get all conversation IDs for this user
        result = await db.execute(
            select(ConversationMember.conversation_id).where(
                ConversationMember.user_id == user_id
            )
        )
        conv_ids = [row[0] for row in result.all()]

        # Get all members for those conversations
        conv_members: dict[uuid.UUID, list[uuid.UUID]] = {}
        if conv_ids:
            result = await db.execute(
                select(ConversationMember).where(
                    ConversationMember.conversation_id.in_(conv_ids)
                )
            )
            for member in result.scalars().all():
                if member.conversation_id not in conv_members:
                    conv_members[member.conversation_id] = []
                conv_members[member.conversation_id].append(member.user_id)

        return conv_members


async def websocket_handler(ws: WebSocket):
    user = await _authenticate_ws(ws)
    if not user:
        await ws.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(ws, user.id)
    logger.info(f"WS connected: user={user.id}")

    # Notify user's contacts that they're online
    conv_members = await _get_user_conversation_member_ids(user.id)
    all_contact_ids = set()
    for members in conv_members.values():
        all_contact_ids.update(members)
    all_contact_ids.discard(user.id)

    await manager.send_to_users(
        list(all_contact_ids),
        {"type": "presence", "user_id": str(user.id), "status": "online"},
    )

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event_type = data.get("type")

            if event_type == "send_message":
                await _handle_send_message(user, data)
            elif event_type == "typing":
                await _handle_typing(user, data)
            elif event_type == "read_receipt":
                await _handle_read_receipt(user, data)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error for user {user.id}: {e}")
    finally:
        disconnected_user_id = manager.disconnect(ws)
        if disconnected_user_id and not manager.is_online(disconnected_user_id):
            await manager.send_to_users(
                list(all_contact_ids),
                {"type": "presence", "user_id": str(disconnected_user_id), "status": "offline"},
            )
        logger.info(f"WS disconnected: user={user.id}")


async def _handle_send_message(user: User, data: dict):
    conv_id = uuid.UUID(data["conversation_id"])

    async with async_session() as db:
        msg = await create_message(
            db,
            conversation_id=conv_id,
            sender_id=user.id,
            message_type=data.get("message_type", "text"),
            encrypted_payloads=data.get("encrypted_payloads", []),
        )

        # Get conversation members
        result = await db.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conv_id
            )
        )
        member_ids = [row[0] for row in result.all()]

    # Send ack to sender
    await manager.send_to_user(user.id, {
        "type": "message_ack",
        "message_id": str(msg.id),
        "conversation_id": str(conv_id),
    })

    # Broadcast to all members (including sender for multi-device)
    broadcast = {
        "type": "new_message",
        "message": {
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "sender_id": str(msg.sender_id),
            "created_at": msg.created_at.isoformat(),
            "message_type": msg.message_type,
            "encrypted_payloads": msg.encrypted_payloads,
        },
        "sender_display_name": user.display_name,
    }
    await manager.send_to_users(member_ids, broadcast, exclude=user.id)


async def _handle_typing(user: User, data: dict):
    conv_id = uuid.UUID(data["conversation_id"])

    async with async_session() as db:
        result = await db.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == conv_id
            )
        )
        member_ids = [row[0] for row in result.all()]

    await manager.send_to_users(
        member_ids,
        {
            "type": "user_typing",
            "conversation_id": str(conv_id),
            "user_id": str(user.id),
            "display_name": user.display_name,
        },
        exclude=user.id,
    )


async def _handle_read_receipt(user: User, data: dict):
    conv_id = uuid.UUID(data["conversation_id"])

    async with async_session() as db:
        # Update last_read_at
        result = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conv_id,
                ConversationMember.user_id == user.id,
            )
        )
        member = result.scalar_one_or_none()
        if member:
            from datetime import datetime, timezone
            member.last_read_at = datetime.now(timezone.utc)
            await db.commit()
