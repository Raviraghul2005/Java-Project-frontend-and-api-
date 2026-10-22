import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getTokenExpiry, isTokenExpired, loadSession, purgeLegacyCaches, saveSession } from "./auth";

const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const makeToken = (exp?: number) => `${b64url({ alg: "HS256" })}.${b64url(exp === undefined ? {} : { exp })}.sig`;
const nowSec = () => Math.floor(Date.now() / 1000);

class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return Array.from(this.data.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("token expiry", () => {
  it("reads the exp claim", () => {
    expect(getTokenExpiry(makeToken(1_900_000_000))).toBe(1_900_000_000);
  });

  it("treats malformed tokens and tokens without exp as expired", () => {
    expect(isTokenExpired("")).toBe(true);
    expect(isTokenExpired("not-a-jwt")).toBe(true);
    expect(isTokenExpired(makeToken())).toBe(true);
  });

  it("distinguishes valid from expired tokens", () => {
    expect(isTokenExpired(makeToken(nowSec() + 3600))).toBe(false);
    expect(isTokenExpired(makeToken(nowSec() - 10))).toBe(true);
  });
});

describe("session storage", () => {
  const user = { id: "u1", name: "Alex", email: "alex@example.com" };

  it("round-trips a valid session", () => {
    const token = makeToken(nowSec() + 3600);
    saveSession({ token, user });
    expect(loadSession()).toEqual({ token, user });
  });

  it("discards and clears an expired session", () => {
    saveSession({ token: makeToken(nowSec() - 60), user });
    expect(loadSession()).toBeNull();
    expect(localStorage.getItem("bp_token")).toBeNull();
    expect(localStorage.getItem("bp_user")).toBeNull();
  });

  it("discards a corrupt user record", () => {
    localStorage.setItem("bp_token", makeToken(nowSec() + 3600));
    localStorage.setItem("bp_user", "{not json");
    expect(loadSession()).toBeNull();
    expect(localStorage.getItem("bp_token")).toBeNull();
  });

  it("clearSession removes every bp_ key but nothing else", () => {
    localStorage.setItem("bp_token", "t");
    localStorage.setItem("bp_subs_u1", "[]");
    localStorage.setItem("theme", "dark");
    clearSession();
    expect(localStorage.getItem("bp_token")).toBeNull();
    expect(localStorage.getItem("bp_subs_u1")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("purgeLegacyCaches removes old subscription caches but keeps the session", () => {
    localStorage.setItem("bp_token", "t");
    localStorage.setItem("bp_subs_u1", "[]");
    localStorage.setItem("bp_local_subs", "[]");
    purgeLegacyCaches();
    expect(localStorage.getItem("bp_token")).toBe("t");
    expect(localStorage.getItem("bp_subs_u1")).toBeNull();
    expect(localStorage.getItem("bp_local_subs")).toBeNull();
  });
});
