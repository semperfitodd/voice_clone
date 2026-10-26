import { beforeEach, vi } from "vitest";

const store = new Map();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value),
  });
});
