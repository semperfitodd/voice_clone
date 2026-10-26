import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AuthCallback from "./pages/AuthCallback.jsx";
import Logout from "./pages/Logout.jsx";
import LandingPage from "./screens/LandingPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AuthCallback />} path="/auth/callback" />
      <Route element={<Logout />} path="/logout" />
      <Route element={<LandingPage />} path="/" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
