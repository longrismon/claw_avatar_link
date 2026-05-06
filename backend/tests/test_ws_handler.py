import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ws_connects():
    with client.websocket_connect("/ws") as ws:
        data = ws.receive_json()
        assert data["type"] == "ready"
        assert "session_id" in data
