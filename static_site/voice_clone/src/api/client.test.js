import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/session.js", () => ({
  ensureFreshIdToken: vi.fn(async () => "test-id-token"),
}));

import apiClient from "./client.js";
import { ensureFreshIdToken } from "../auth/session.js";

describe("apiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches bearer token on requests", async () => {
    const adapter = vi.fn(async (config) => ({
      config,
      data: {},
      headers: {},
      status: 200,
      statusText: "OK",
    }));
    apiClient.defaults.adapter = adapter;

    await apiClient.get("/outputs");

    expect(ensureFreshIdToken).toHaveBeenCalled();
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer test-id-token");
  });
});
