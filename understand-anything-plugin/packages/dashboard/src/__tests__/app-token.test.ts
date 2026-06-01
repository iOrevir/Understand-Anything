import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveInitialToken, SESSION_TOKEN_KEY } from "../App";

function createStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

describe("resolveInitialToken", () => {
  const originalWindow = globalThis.window;
  const originalSessionStorage = globalThis.sessionStorage;

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: originalSessionStorage,
      configurable: true,
      writable: true,
    });
  });

  it("persists token from URL and strips it from browser history URL", () => {
    const sessionStorage = createStorage();
    const replaceState = vi.fn();
    const windowMock = {
      location: {
        search: "?token=abc123&view=graph",
        pathname: "/",
        hash: "#details",
      },
      history: { replaceState },
    };

    Object.defineProperty(globalThis, "window", {
      value: windowMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: sessionStorage,
      configurable: true,
      writable: true,
    });

    const token = resolveInitialToken();
    expect(token).toBe("abc123");
    expect(sessionStorage.getItem(SESSION_TOKEN_KEY)).toBe("abc123");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/?view=graph#details");
  });

  it("falls back to sessionStorage token when URL has no token", () => {
    const sessionStorage = createStorage({ [SESSION_TOKEN_KEY]: "persisted-token" });
    const replaceState = vi.fn();
    const windowMock = {
      location: {
        search: "?view=graph",
        pathname: "/",
        hash: "",
      },
      history: { replaceState },
    };

    Object.defineProperty(globalThis, "window", {
      value: windowMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: sessionStorage,
      configurable: true,
      writable: true,
    });

    const token = resolveInitialToken();
    expect(token).toBe("persisted-token");
    expect(replaceState).not.toHaveBeenCalled();
  });
});
