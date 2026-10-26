import { describe, expect, it } from "vitest";

import { buildAuthorizeUrl } from "./cognito-oauth.js";

describe("buildAuthorizeUrl", () => {
  it("includes PKCE, state, and nonce parameters", () => {
    const url = buildAuthorizeUrl(
      {
        clientId: "client-123",
        domain: "auth.example.com",
        logoutUri: "https://app.example.com/logout",
        redirectUri: "https://app.example.com/auth/callback",
        region: "us-east-1",
        userPoolId: "pool",
      },
      {
        challenge: "challenge-value",
        nonce: "nonce-value",
        state: "state-value",
      },
    );

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("auth.example.com");
    expect(parsed.pathname).toBe("/oauth2/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("client-123");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe("state-value");
    expect(parsed.searchParams.get("nonce")).toBe("nonce-value");
  });
});
