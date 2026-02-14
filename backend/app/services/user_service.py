import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.user import User


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: User, display_name: str | None = None) -> User:
    if display_name is not None:
        user.display_name = display_name
    await db.commit()
    await db.refresh(user)
    return user


async def search_users(db: AsyncSession, school_id: uuid.UUID, query: str, exclude_id: uuid.UUID | None = None) -> list[User]:
    stmt = (
        select(User)
        .where(User.school_id == school_id, User.is_verified == True)
        .where(
            User.display_name.ilike(f"%{query}%") | User.email.ilike(f"%{query}%")
        )
        .limit(20)
    )
    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
