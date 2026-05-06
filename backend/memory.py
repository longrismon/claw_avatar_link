from collections import defaultdict, deque
from typing import List

from config import settings

# In-memory session store: session_id → deque of {role, content} dicts
_sessions: dict[str, deque] = defaultdict(
    lambda: deque(maxlen=settings.max_memory_turns * 2)  # *2 for user+assistant pairs
)


def add_turn(session_id: str, role: str, content: str) -> None:
    _sessions[session_id].append({"role": role, "content": content})


def get_history(session_id: str) -> List[dict]:
    return list(_sessions[session_id])


def clear_session(session_id: str) -> None:
    _sessions[session_id].clear()
