import logging
import os
import re
from functools import wraps

import jwt
import requests
from flask import jsonify, request
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

_jwks_client = None
_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_FILENAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


class AuthError(Exception):
    def __init__(self, message, status_code=401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _cognito_settings():
    region = os.environ.get("COGNITO_REGION", "").strip()
    pool_id = os.environ.get("COGNITO_USER_POOL_ID", "").strip()
    client_id = os.environ.get("COGNITO_CLIENT_ID", "").strip()
    if not region or not pool_id or not client_id:
        raise AuthError("Authentication is not configured", 503)
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"
    return region, pool_id, client_id, issuer


def _jwks_client():
    global _jwks_client
    if _jwks_client is None:
        _, pool_id, _, issuer = _cognito_settings()
        _jwks_client = PyJWKClient(f"{issuer}/.well-known/jwks.json", cache_keys=True)
    return _jwks_client


def sanitize_email(raw_email):
    if not raw_email or not isinstance(raw_email, str):
        return None
    email = raw_email.strip().lower()
    if not _EMAIL_PATTERN.match(email):
        return None
    return email.replace("/", "_").replace("..", "_")


def safe_filename(filename):
    if not filename or not isinstance(filename, str):
        return None
    base = filename.strip()
    if base != os.path.basename(base) or not _FILENAME_PATTERN.match(base):
        return None
    if not base.lower().endswith(".wav"):
        return None
    return base


def _extract_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    return token or None


def verify_id_token(token):
    try:
        _, _, client_id, issuer = _cognito_settings()
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=issuer,
            options={"require": ["exp", "iss", "aud", "email"]},
        )
        email = sanitize_email(claims.get("email"))
        if not email:
            raise AuthError("Invalid token identity", 403)
        return email
    except AuthError:
        raise
    except jwt.PyJWTError as exc:
        logger.warning("JWT verification failed: %s", type(exc).__name__)
        raise AuthError("Unauthorized", 401) from exc
    except requests.RequestException as exc:
        logger.error("JWKS fetch failed: %s", type(exc).__name__)
        raise AuthError("Authentication unavailable", 503) from exc


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_bearer_token()
        if not token:
            return jsonify({"error": "Unauthorized"}), 401
        try:
            request.user_email = verify_id_token(token)
        except AuthError as exc:
            return jsonify({"error": exc.message}), exc.status_code
        return f(*args, **kwargs)

    return decorated
