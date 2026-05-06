import re

_RULES = [
    ("wave",     r"\b(hello|hi|hey|good morning|good evening|goodbye|bye|welcome)\b"),
    ("nod",      r"\b(yes|correct|exactly|absolutely|right|indeed|confirmed|sure)\b"),
    ("thinking", r"\b(let me|checking|searching|looking|one moment|give me a sec|i'll find)\b"),
    ("shrug",    r"\b(not sure|don't know|unclear|uncertain|maybe|perhaps|possibly)\b"),
    ("point",    r"\b(here|there|this|that|look at|see this|check this)\b"),
]


def intent_to_gesture(text: str) -> str:
    """Map agent reply text to a gesture animation name."""
    if not text.strip():
        return "idle"
    lower = text.lower()
    for gesture, pattern in _RULES:
        if re.search(pattern, lower):
            return gesture
    return "talking"
