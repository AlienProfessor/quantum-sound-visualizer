from typing import List
from fastapi import WebSocket
import asyncio


class ConnectionManager:
    """
    高性能 WebSocket 连接管理 (防丢帧优化版)
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"Client disconnected. Remaining clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """
        广播消息。如果有断开的死连接，安全地清理它们。
        """
        dead_connections = []
        for connection in self.active_connections:
            try:
                # 使用 send_json 传输数据
                await connection.send_json(message)
            except RuntimeError as e:
                # 捕获断开连接导致的 RuntimeError
                dead_connections.append(connection)
            except Exception as e:
                print(f"WebSocket send error: {e}")
                dead_connections.append(connection)

        # 清理失效连接
        for dead in dead_connections:
            self.disconnect(dead)