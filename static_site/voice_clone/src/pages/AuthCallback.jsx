import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext.jsx";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const storedState = sessionStorage.getItem("oauth_state");

    sessionStorage.removeItem("oauth_state");
    sessionStorage.removeItem("oidc_nonce");

    if (!code || !state || state !== storedState) {
      setError("Sign-in could not be verified. Please try again.");
      return;
    }

    completeLogin(code)
      .then(() => {
        sessionStorage.removeItem("pkce_verifier");
        navigate("/", { replace: true });
      })
      .catch(() => {
        sessionStorage.removeItem("pkce_verifier");
        setError("Sign-in failed. Please try again.");
      });
  }, [completeLogin, navigate]);

  if (error) {
    return (
      <div className="page-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-center">
      <p className="text-gray-600">Completing sign-in…</p>
    </div>
  );
}
