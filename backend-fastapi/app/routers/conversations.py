import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.conversation import AddMemberRequest, ConversationCreate, ConversationOut, MemberOut
from backend.app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _conv_to_out(conv, db_users: dict | None = None) -> ConversationOut:
    members = []
    for m in conv.members:
        members.append(MemberOut(
            user_id=m.user_id,
            display_name=db_users[m.user_id].display_name if db_users and m.user_id in db_users else "",
            email=db_users[m.user_id].email if db_users and m.user_id in db_users else "",
            joined_at=m.joined_at,
        ))
    return ConversationOut(
        id=conv.id,
        type=conv.type,
        name=conv.name,
        school_id=conv.school_id,
        created_by=conv.created_by,
        created_at=conv.created_at,
        members=members,
    )


async def _load_member_users(db: AsyncSession, conv) -> dict:
    from sqlalchemy import select
    from backend.app.models.user import User as UserModel
    user_ids = [m.user_id for m in conv.members]
    result = await db.execute(select(UserModel).where(UserModel.id.in_(user_ids)))
    return {u.id: u for u in result.scalars().all()}


@router.post("", response_model=ConversationOut)
async def create(
    body: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await conversation_service.create_conversation(
        db, current_user, body.type, body.member_ids, body.name
    )
    users = await _load_member_users(db, conv)
    return _conv_to_out(conv, users)


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    convs = await conversation_service.get_conversations(db, current_user.id)
    result = []
    for conv in convs:
        users = await _load_member_users(db, conv)
        result.append(_conv_to_out(conv, users))
    return result


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await conversation_service.get_conversation(db, conversation_id)
    users = await _load_member_users(db, conv)
    return _conv_to_out(conv, users)


@router.post("/{conversation_id}/members")
async def add_member(
    conversation_id: uuid.UUID,
    body: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await conversation_service.add_member(db, conversation_id, body.user_id, current_user)
    return {"message": "Member added"}


@router.delete("/{conversation_id}/members/{user_id}")
async def remove_member(
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await conversation_service.remove_member(db, conversation_id, user_id, current_user)
    return {"message": "Member removed"}
