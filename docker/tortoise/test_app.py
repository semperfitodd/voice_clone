import os
import sys
from unittest.mock import MagicMock, patch

os.environ.setdefault("COGNITO_REGION", "us-east-1")
os.environ.setdefault("COGNITO_USER_POOL_ID", "us-east-1_TestPool")
os.environ.setdefault("COGNITO_CLIENT_ID", "test-client-id")
os.environ.setdefault("TORTOISE_VOICE_DIR", "/tmp/voice-clone-test-voices")

for module_name in ["numpy", "soundfile", "torch", "tortoise", "tortoise.api", "tortoise.utils", "tortoise.utils.audio"]:
    sys.modules.setdefault(module_name, MagicMock())

import app  # noqa: E402


def test_health_check_does_not_require_auth():
    client = app.app.test_client()
    response = client.get("/synthesize")
    assert response.status_code == 200
    assert b"Health check OK" in response.data


def test_post_synthesize_requires_auth():
    client = app.app.test_client()
    response = client.post("/synthesize", json={"text": "hello"})
    assert response.status_code == 401


@patch("auth.verify_id_token", return_value="user@example.com")
def test_list_outputs_uses_token_identity(mock_verify):
    client = app.app.test_client()
    response = client.get("/outputs", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200
    assert response.get_json() == []
    mock_verify.assert_called_once_with("test-token")


@patch("auth.verify_id_token", return_value="user@example.com")
def test_serve_output_rejects_unsafe_filename(mock_verify):
    client = app.app.test_client()
    response = client.get("/outputs/not-a-wav.txt", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 400
