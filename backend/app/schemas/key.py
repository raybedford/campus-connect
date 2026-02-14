import uuid
from datetime import datetime

from pydantic import BaseModel


class PublishKeyRequest(BaseModel):
    public_key_b64: str


class PublicKeyOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    key_type: str
    public_key_b64: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
