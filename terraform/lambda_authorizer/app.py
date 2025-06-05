import json
import logging
import os
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

secrets_manager = boto3.client("secretsmanager")

def get_secret(secret_name):
    try:
        response = secrets_manager.get_secret_value(SecretId=secret_name)
        secret = json.loads(response["SecretString"])
        return secret["API_KEY"]
    except Exception as e:
        logger.error(f"Error fetching secret '{secret_name}': {e}")
        raise ValueError("Failed to retrieve API key secret")

def lambda_handler(event, context):
    logger.info("Received event: %s", json.dumps(event))

    try:
        secret_name = os.environ.get("API_KEY_SECRET")
        if not secret_name:
            logger.error("Missing environment variable: API_KEY_SECRET")
            raise ValueError("API_KEY_SECRET environment variable is not set")

        api_key_secret = get_secret(secret_name)

        headers = event.get("headers", {})
        client_key = headers.get("x-api-key")

        if client_key is None:
            logger.warning("Missing x-api-key header in request")
            return {"isAuthorized": False}

        if not client_key.strip():
            logger.warning("x-api-key header is present but empty")
            return {"isAuthorized": False}

        if client_key.strip() != api_key_secret.strip():
            logger.warning(
                "x-api-key mismatch. Received: '%s', Expected: '%s'",
                client_key.strip(),
                api_key_secret.strip()
            )
            return {"isAuthorized": False}

        logger.info("Authorization succeeded")
        return {"isAuthorized": True}

    except Exception as e:
        logger.exception("Unexpected error in authorizer")
        return {"isAuthorized": False}
