import React, { useState } from "react";

import { useAuth } from "../contexts/AuthContext.jsx";

export default function LoginButton() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login();
    } catch {
      setError("Sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={loading}
        onClick={handleLogin}
      >
        {loading ? "Redirecting…" : "Sign in with Google"}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
