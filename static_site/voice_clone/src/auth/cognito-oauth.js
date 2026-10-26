function parseTokenResponseBody(text, action) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${action} failed: response was not valid JSON`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${action} failed: response was not a JSON object`);
  }

  if (typeof parsed.access_token !== "string" || typeof parsed.id_token !== "string") {
    throw new Error(`${action} failed: missing required token fields`);
  }

  return {
    access_token: parsed.access_token,
    expires_in: typeof parsed.expires_in === "number" ? parsed.expires_in : undefined,
    id_token: parsed.id_token,
    refresh_token: typeof parsed.refresh_token === "string" ? parsed.refresh_token : undefined,
    token_type: typeof parsed.token_type === "string" ? parsed.token_type : undefined,
  };
}

async function readTokenResponse(response, action) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${action} failed: ${response.status}`);
  }
  return parseTokenResponseBody(text, action);
}

function tokenEndpoint(config) {
  return `https://${config.domain}/oauth2/token`;
}

function authorizeEndpoint(config) {
  return `https://${config.domain}/oauth2/authorize`;
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

export async function generatePKCE() {
  const verifier = randomString(64);
  const encoded = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const challenge = base64UrlEncode(new Uint8Array(hashBuffer));
  return { challenge, verifier };
}

export function generateOAuthState() {
  return randomString(32);
}

export function generateOidcNonce() {
  return randomString(32);
}

export function buildAuthorizeUrl(config, params) {
  const query = new URLSearchParams({
    client_id: config.clientId,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
    nonce: params.nonce,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "email openid profile",
    state: params.state,
  });

  return `${authorizeEndpoint(config)}?${query.toString()}`;
}

export function buildLogoutUrl(config) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });
  return `https://${config.domain}/logout?${params.toString()}`;
}

export async function exchangeCodeForTokens(config, code, verifier) {
  const response = await fetch(tokenEndpoint(config), {
    body: new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  return readTokenResponse(response, "Token exchange");
}

export async function refreshTokens(config, refreshToken) {
  const response = await fetch(tokenEndpoint(config), {
    body: new URLSearchParams({
      client_id: config.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  return readTokenResponse(response, "Token refresh");
}
