import re

_RULES = [
    ("happy",     r"\b(great|wonderful|excellent|glad|happy|love|amazing|fantastic|perfect|delighted|pleased)\b"),
    ("sad",       r"\b(sorry|unfortunately|regret|sad|apolog|miss|disappoint|can't help|unable)\b"),
    ("surprised", r"\b(wow|really|seriously|unexpected|actually|interesting|wait|oh|incredible|unbelievable)\b"),
    ("angry",     r"\b(wrong|incorrect|never|absolutely not|stop|error|fail|invalid|denied)\b"),
    ("thinking",  r"\b(let me|checking|searching|looking|one moment|give me a sec|i'll find|computing)\b"),
]


def text_to_emotion(text: str) -> str:
    """Map agent reply text to a facial emotion name."""
    if not text.strip():
        return "neutral"
    lower = text.lower()
    for emotion, pattern in _RULES:
        if re.search(pattern, lower):
            return emotion
    return "neutral"
