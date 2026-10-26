import os

os.environ.setdefault("COGNITO_REGION", "us-east-1")
os.environ.setdefault("COGNITO_USER_POOL_ID", "us-east-1_TestPool")
os.environ.setdefault("COGNITO_CLIENT_ID", "test-client-id")

from auth import safe_filename, sanitize_email  # noqa: E402


def test_sanitize_email_accepts_valid_address():
    assert sanitize_email("User@Example.com") == "user@example.com"


def test_sanitize_email_rejects_invalid():
    assert sanitize_email("not-an-email") is None
    assert sanitize_email("") is None


def test_safe_filename_rejects_traversal():
    assert safe_filename("../secret.wav") is None
    assert safe_filename("voice.wav") == "voice.wav"
