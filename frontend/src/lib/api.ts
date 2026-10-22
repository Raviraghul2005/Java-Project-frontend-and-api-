import {
  Subscription,
  User,
  CreateSubscriptionInput,
  AnalyticsData,
  StatementAnalysis
} from "@/types";
import { TOKEN_KEY } from "@/lib/auth";

// Origin of the Spring Boot API (no trailing slash). Override with NEXT_PUBLIC_API_URL for other environments.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5500").replace(/\/+$/, "");
const API_BASE = `${API_ORIGIN}/api/v1`;

const REQUEST_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 4_000;

/** Thrown for any non-2xx response; `status` lets callers distinguish auth failures from the rest. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registers the callback invoked when the API rejects the stored token (expired, revoked or forged). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, { auth = true } = {}): Promise<T> {
  // Multipart bodies must not get a JSON content type: the browser sets the boundary itself.
  const isMultipart = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isMultipart ? {} : { "Content-Type": "application/json" }),
    ...getAuthHeader(),
    ...options.headers
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE}${endpoint}`, { ...options, headers }, REQUEST_TIMEOUT_MS);
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(timedOut ? "The server took too long to respond" : "Cannot reach the server", 0);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // A 401 on a protected call means the session is dead; sign-in/up 401s are ordinary "wrong password" errors.
    if (res.status === 401 && auth && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const message = data?.message || data?.error || `HTTP error ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return data;
}

const encodeId = (id: string) => encodeURIComponent(id);

export const api = {
  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await fetchWithTimeout(`${API_ORIGIN}/api`, { method: "GET" }, HEALTH_TIMEOUT_MS);
      return res.ok;
    } catch {
      return false;
    }
  },

  signUp: async (userData: { name: string; email: string; password: string }) => {
    return request<{ success: boolean; data: { token: string; user: User } }>(
      "/auth/sign-up",
      { method: "POST", body: JSON.stringify(userData) },
      { auth: false }
    );
  },

  signIn: async (credentials: { email: string; password: string }) => {
    return request<{ success: boolean; data: { token: string; user: User } }>(
      "/auth/sign-in",
      { method: "POST", body: JSON.stringify(credentials) },
      { auth: false }
    );
  },

  signOut: async () => {
    return request<{ success: boolean }>("/auth/sign-out", { method: "POST" }, { auth: false });
  },

  getUserSubscriptions: async (userId: string): Promise<Subscription[]> => {
    const res = await request<{ success: boolean; data: Subscription[] }>(`/subscriptions/user/${encodeId(userId)}`);
    return res.data || [];
  },

  createSubscription: async (subData: CreateSubscriptionInput): Promise<Subscription> => {
    const res = await request<{ success: boolean; data: Subscription }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(subData)
    });
    return res.data;
  },

  updateSubscription: async (id: string, subData: Partial<CreateSubscriptionInput>): Promise<Subscription> => {
    const res = await request<{ success: boolean; data: Subscription }>(`/subscriptions/${encodeId(id)}`, {
      method: "PUT",
      body: JSON.stringify(subData)
    });
    return res.data;
  },

  cancelSubscription: async (id: string): Promise<Subscription> => {
    const res = await request<{ success: boolean; data: Subscription }>(`/subscriptions/${encodeId(id)}/cancel`, {
      method: "PUT"
    });
    return res.data;
  },

  deleteSubscription: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/subscriptions/${encodeId(id)}`, {
      method: "DELETE"
    });
  },

  analyzeStatement: async (file: File): Promise<StatementAnalysis> => {
    const form = new FormData();
    form.append("file", file);
    const res = await request<{ success: boolean; data: StatementAnalysis }>("/statements/analyze", {
      method: "POST",
      body: form
    });
    return res.data;
  },

  getAnalyticsAudit: async (): Promise<AnalyticsData> => {
    const res = await request<{ success: boolean; data: AnalyticsData }>("/analytics/audit");
    return res.data;
  }
};
