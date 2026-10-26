import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  buildLogoutUrl,
  exchangeCodeForTokens,
  generateOAuthState,
  generateOidcNonce,
  generatePKCE,
  buildAuthorizeUrl,
} from "../auth/cognito-oauth.js";
import { getOAuthConfig } from "../config/env.js";
import {
  clearSession,
  getEmailFromIdToken,
  getStoredIdToken,
  saveTokens,
} from "../auth/session.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [idToken, setIdToken] = useState(() => getStoredIdToken());

  const email = useMemo(() => (idToken ? getEmailFromIdToken(idToken) : null), [idToken]);

  const login = useCallback(async () => {
    const config = getOAuthConfig();
    const { challenge, verifier } = await generatePKCE();
    const state = generateOAuthState();
    const nonce = generateOidcNonce();

    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oidc_nonce", nonce);

    window.location.href = buildAuthorizeUrl(config, { challenge, nonce, state });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setIdToken(null);
    const config = getOAuthConfig();
    window.location.href = buildLogoutUrl(config);
  }, []);

  const completeLogin = useCallback(async (code) => {
    const config = getOAuthConfig();
    const verifier = sessionStorage.getItem("pkce_verifier");
    if (!verifier) {
      throw new Error("Missing PKCE verifier");
    }
    const tokens = await exchangeCodeForTokens(config, code, verifier);
    saveTokens(tokens);
    setIdToken(tokens.id_token);
  }, []);

  const value = useMemo(
    () => ({
      completeLogin,
      email,
      idToken,
      isAuthenticated: Boolean(idToken && email),
      login,
      logout,
      setIdToken,
    }),
    [completeLogin, email, idToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
