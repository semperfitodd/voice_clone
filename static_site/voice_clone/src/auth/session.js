import { getOAuthConfig } from "../config/env.js";
import { refreshTokens } from "./cognito-oauth.js";

const ID_TOKEN_KEY = "voice_clone_id_token";
const REFRESH_TOKEN_KEY = "voice_clone_refresh_token";
const EXPIRES_AT_KEY = "voice_clone_expires_at";

export function decodeJwtPayload(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(window.atob(base64));
}

export function getEmailFromIdToken(idToken) {
  const payload = decodeJwtPayload(idToken);
  return typeof payload.email === "string" ? payload.email : null;
}

export function saveTokens(tokenResponse) {
  sessionStorage.setItem(ID_TOKEN_KEY, tokenResponse.id_token);
  if (tokenResponse.refresh_token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokenResponse.refresh_token);
  }
  const expiresIn = tokenResponse.expires_in ?? 3600;
  const expiresAt = Date.now() + expiresIn * 1000;
  sessionStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
}

export function clearSession() {
  sessionStorage.removeItem(ID_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_AT_KEY);
  sessionStorage.removeItem("pkce_verifier");
  sessionStorage.removeItem("oauth_state");
  sessionStorage.removeItem("oidc_nonce");
}

export function getStoredIdToken() {
  return sessionStorage.getItem(ID_TOKEN_KEY);
}

function getExpiresAt() {
  const raw = sessionStorage.getItem(EXPIRES_AT_KEY);
  return raw ? Number(raw) : 0;
}

export async function ensureFreshIdToken() {
  const idToken = getStoredIdToken();
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  const expiresAt = getExpiresAt();
  const refreshBufferMs = 5 * 60 * 1000;

  if (idToken && expiresAt - Date.now() > refreshBufferMs) {
    return idToken;
  }

  if (!refreshToken) {
    return idToken;
  }

  const config = getOAuthConfig();
  const refreshed = await refreshTokens(config, refreshToken);
  saveTokens(refreshed);
  return refreshed.id_token;
}
