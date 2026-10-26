import axios from "axios";

import { ensureFreshIdToken } from "../auth/session.js";

const apiClient = axios.create();

apiClient.interceptors.request.use(async (config) => {
  const token = await ensureFreshIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
