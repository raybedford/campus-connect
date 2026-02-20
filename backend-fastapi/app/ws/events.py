from pydantic import BaseModel


class SendMessageEvent(BaseModel):
    type: str  # "send_message"
    conversation_id: str
    message_type: str  # "text" or "file"
    encrypted_payloads: list[dict]


class TypingEvent(BaseModel):
    type: str  # "typing"
    conversation_id: str


class ReadReceiptEvent(BaseModel):
    type: str  # "read_receipt"
    conversation_id: str
    message_id: str
