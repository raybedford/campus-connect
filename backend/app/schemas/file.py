import uuid
from datetime import datetime

from pydantic import BaseModel


class FileAttachmentOut(BaseModel):
    id: uuid.UUID
    message_id: uuid.UUID
    original_filename: str
    file_size_bytes: int
    mime_type: str | None = None
    is_deleted: bool
    created_at: datetime

    model_config = {"from_attributes": True}
