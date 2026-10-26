let cachedConfig = null;

export function getVoiceCloneConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const raw = window.__VOICE_CLONE_CONFIG__;
  if (!raw) {
    throw new Error(
      "Voice Clone config not loaded. Ensure config.js is included before the app bundle.",
    );
  }

  const required = [
    "AWS_REGION",
    "COGNITO_CLIENT_ID",
    "COGNITO_DOMAIN",
    "COGNITO_LOGOUT_URI",
    "COGNITO_REDIRECT_URI",
    "COGNITO_USER_POOL_ID",
  ];

  for (const key of required) {
    if (!raw[key] || typeof raw[key] !== "string") {
      throw new Error(`Voice Clone config missing ${key}`);
    }
  }

  cachedConfig = raw;
  return cachedConfig;
}

export function getOAuthConfig() {
  const config = getVoiceCloneConfig();
  return {
    clientId: config.COGNITO_CLIENT_ID,
    domain: config.COGNITO_DOMAIN,
    logoutUri: config.COGNITO_LOGOUT_URI,
    redirectUri: config.COGNITO_REDIRECT_URI,
    region: config.AWS_REGION,
    userPoolId: config.COGNITO_USER_POOL_ID,
  };
}
