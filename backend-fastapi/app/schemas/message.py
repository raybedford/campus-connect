import uuid
from datetime import datetime

from pydantic import BaseModel


class EncryptedPayload(BaseModel):
    recipient_id: uuid.UUID
    ciphertext_b64: str
    nonce_b64: str


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    created_at: datetime
    message_type: str
    encrypted_payloads: list[EncryptedPayload]
    sender_display_name: str | None = None

    model_config = {"from_attributes": True}
