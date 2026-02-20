import os
import uuid

import aiofiles
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.exceptions import BadRequest, Forbidden, NotFound
from backend.app.models.conversation import ConversationMember
from backend.app.models.file_attachment import FileAttachment, FileDownload


async def save_upload(
    db: AsyncSession,
    message_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    filename: str,
    content: bytes,
    content_type: str | None,
) -> FileAttachment:
    if len(content) > settings.max_file_size_bytes:
        raise BadRequest(f"File exceeds {settings.max_file_size_bytes // (1024*1024)}MB limit")

    # Count recipients
    result = await db.execute(
        select(func.count()).where(ConversationMember.conversation_id == conversation_id)
    )
    total_recipients = result.scalar() or 0

    stored_filename = f"{uuid.uuid4()}.enc"
    upload_dir = settings.upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, stored_filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    attachment = FileAttachment(
        message_id=message_id,
        original_filename=filename,
        stored_filename=stored_filename,
        file_size_bytes=len(content),
        mime_type=content_type,
        total_recipients=total_recipients,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return attachment


async def download_file(
    db: AsyncSession,
    attachment_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[str, str, str | None]:
    """Returns (filepath, original_filename, mime_type)."""
    result = await db.execute(
        select(FileAttachment).where(FileAttachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise NotFound("File not found")
    if attachment.is_deleted:
        raise NotFound("File has been deleted")

    filepath = os.path.join(settings.upload_dir, attachment.stored_filename)
    if not os.path.exists(filepath):
        raise NotFound("File not found on disk")

    # Record download (idempotent)
    existing = await db.execute(
        select(FileDownload).where(
            FileDownload.attachment_id == attachment_id,
            FileDownload.user_id == user_id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(FileDownload(attachment_id=attachment_id, user_id=user_id))
        await db.commit()

    # Check if all recipients have downloaded
    count_result = await db.execute(
        select(func.count()).where(FileDownload.attachment_id == attachment_id)
    )
    download_count = count_result.scalar() or 0

    if download_count >= attachment.total_recipients:
        # Delete file from disk
        try:
            os.remove(filepath)
        except OSError:
            pass
        attachment.is_deleted = True
        await db.commit()

    return filepath, attachment.original_filename, attachment.mime_type


async def cleanup_old_files(db: AsyncSession) -> int:
    """Delete files older than max age. Returns count of deleted files."""
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.file_max_age_hours)
    result = await db.execute(
        select(FileAttachment).where(
            FileAttachment.created_at < cutoff,
            FileAttachment.is_deleted == False,
        )
    )
    deleted = 0
    for attachment in result.scalars().all():
        filepath = os.path.join(settings.upload_dir, attachment.stored_filename)
        try:
            os.remove(filepath)
        except OSError:
            pass
        attachment.is_deleted = True
        deleted += 1

    if deleted:
        await db.commit()
    return deleted
