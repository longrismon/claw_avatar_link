import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gesture import intent_to_gesture


def test_greeting_maps_to_wave():
    assert intent_to_gesture("Hello! How can I help you today?") == "wave"


def test_affirmation_maps_to_nod():
    assert intent_to_gesture("Yes, that's correct.") == "nod"


def test_unknown_maps_to_talking():
    assert intent_to_gesture("The weather is sunny today.") == "talking"


def test_thinking_phrase_maps_to_thinking():
    assert intent_to_gesture("Let me check that for you...") == "thinking"


def test_empty_maps_to_idle():
    assert intent_to_gesture("") == "idle"
