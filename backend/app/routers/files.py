import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.file import FileAttachmentOut
from backend.app.services import file_service

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=FileAttachmentOut)
async def upload(
    file: UploadFile = File(...),
    message_id: str = Form(...),
    conversation_id: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    attachment = await file_service.save_upload(
        db,
        message_id=uuid.UUID(message_id),
        conversation_id=uuid.UUID(conversation_id),
        user_id=current_user.id,
        filename=file.filename or "unnamed",
        content=content,
        content_type=file.content_type,
    )
    return attachment


@router.get("/{attachment_id}/download")
async def download(
    attachment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filepath, filename, mime_type = await file_service.download_file(
        db, attachment_id, current_user.id
    )
    return FileResponse(
        filepath,
        filename=filename,
        media_type=mime_type or "application/octet-stream",
    )
