import { beforeEach, describe, expect, it } from "vitest";

import { recordingsComplete } from "./recordings.js";

describe("recordingsComplete", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when any recording is missing", () => {
    localStorage.setItem("voiceclone_user@example.com_0", "true");
    expect(recordingsComplete("user@example.com")).toBe(false);
  });

  it("returns true when all five recordings exist", () => {
    for (let i = 0; i < 5; i++) {
      localStorage.setItem(`voiceclone_user@example.com_${i}`, "true");
    }
    expect(recordingsComplete("user@example.com")).toBe(true);
  });
});
