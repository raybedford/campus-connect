import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database import async_session
from backend.app.routers import auth, users, conversations, messages, keys, files
from backend.app.services.file_service import cleanup_old_files
from backend.app.ws.handler import websocket_handler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _file_cleanup_loop():
    """Background task to delete files older than max age."""
    while True:
        await asyncio.sleep(3600)  # Run every hour
        try:
            async with async_session() as db:
                deleted = await cleanup_old_files(db)
                if deleted:
                    logger.info(f"Cleaned up {deleted} expired file(s)")
        except Exception as e:
            logger.error(f"File cleanup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    task = asyncio.create_task(_file_cleanup_loop())
    yield
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Campus Connect", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(keys.router)
app.include_router(files.router)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await websocket_handler(ws)


@app.get("/health")
async def health():
    return {"status": "ok"}
