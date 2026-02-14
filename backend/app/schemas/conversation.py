import uuid
from datetime import datetime

from pydantic import BaseModel


class ConversationCreate(BaseModel):
    type: str  # "dm" or "group"
    name: str | None = None
    member_ids: list[uuid.UUID]


class MemberOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    email: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: uuid.UUID
    type: str
    name: str | None = None
    school_id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    members: list[MemberOut] = []

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
