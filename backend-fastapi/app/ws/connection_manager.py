import uuid
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # user_id -> set of WebSocket connections
        self._connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        # websocket -> user_id (reverse lookup)
        self._ws_to_user: dict[WebSocket, uuid.UUID] = {}

    async def connect(self, ws: WebSocket, user_id: uuid.UUID):
        await ws.accept()
        self._connections[user_id].add(ws)
        self._ws_to_user[ws] = user_id

    def disconnect(self, ws: WebSocket):
        user_id = self._ws_to_user.pop(ws, None)
        if user_id and ws in self._connections[user_id]:
            self._connections[user_id].discard(ws)
            if not self._connections[user_id]:
                del self._connections[user_id]
        return user_id

    def is_online(self, user_id: uuid.UUID) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to_user(self, user_id: uuid.UUID, data: dict):
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                self._connections[user_id].discard(ws)

    async def send_to_users(self, user_ids: list[uuid.UUID], data: dict, exclude: uuid.UUID | None = None):
        for uid in user_ids:
            if uid != exclude:
                await self.send_to_user(uid, data)

    def get_online_user_ids(self) -> set[uuid.UUID]:
        return set(self._connections.keys())


manager = ConnectionManager()
