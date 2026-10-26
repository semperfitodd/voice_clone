import React, { useEffect } from "react";

import { clearSession } from "../auth/session.js";

export default function Logout() {
  useEffect(() => {
    clearSession();
    window.location.replace("/");
  }, []);

  return (
    <div className="page-center">
      <p className="text-gray-600">Signing out…</p>
    </div>
  );
}
