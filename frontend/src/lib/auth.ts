import type { User } from "@/types";

export const TOKEN_KEY = "bp_token";
export const USER_KEY = "bp_user";
const STORAGE_PREFIX = "bp_";

/** Decodes the `exp` claim (seconds since epoch) of a JWT without verifying it. Server still validates. */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/** True when the token is malformed, has no expiry, or has expired (with a small clock-skew allowance). */
export function isTokenExpired(token: string, nowMs: number = Date.now()): boolean {
  const exp = getTokenExpiry(token);
  if (exp === null) return true;
  return exp * 1000 <= nowMs + 5_000;
}

export interface StoredSession {
  token: string;
  user: User;
}

/** Reads the saved session, discarding (and clearing) anything corrupt or expired. */
export function loadSession(): StoredSession | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (!token || !userJson) return null;

    const user = JSON.parse(userJson) as User;
    if (!user || typeof user.id !== "string" || isTokenExpired(token)) {
      clearSession();
      return null;
    }
    return { token, user };
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  } catch {
    // Storage unavailable (private mode / quota): the session just won't survive a reload.
  }
}

/**
 * Older versions cached each user's subscriptions in localStorage (`bp_subs_<id>`, `bp_local_subs`).
 * The server is now the only source of truth, so remove those leftovers.
 */
export function purgeLegacyCaches(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("bp_subs_") || key === "bp_local_subs")) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/** Removes every `bp_*` key (session plus any legacy per-user caches left by older versions). */
export function clearSession(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
