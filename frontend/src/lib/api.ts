import {
  Subscription,
  User,
  CreateSubscriptionInput,
  AnalyticsData
} from "@/types";

const API_BASE = "http://localhost:5500/api/v1";

// Demo fallback data if backend is offline or unseeded
export const SEED_SUBSCRIPTIONS: Subscription[] = [
  {
    id: "sub-netflix",
    name: "Netflix Premium",
    price: 22.99,
    currency: "USD",
    frequency: "monthly",
    category: "entertainment",
    paymentMethod: "Credit Card (Visa 4242)",
    status: "active",
    startDate: "2026-01-15",
    renewalDate: "2026-10-15"
  },
  {
    id: "sub-claude",
    name: "Claude Pro",
    price: 20.0,
    currency: "USD",
    frequency: "monthly",
    category: "technology",
    paymentMethod: "Apple Pay",
    status: "active",
    startDate: "2026-03-01",
    renewalDate: "2026-10-12"
  },
  {
    id: "sub-chatgpt",
    name: "ChatGPT Plus",
    price: 20.0,
    currency: "USD",
    frequency: "monthly",
    category: "technology",
    paymentMethod: "Credit Card",
    status: "active",
    startDate: "2026-02-10",
    renewalDate: "2026-10-12"
  },
  {
    id: "sub-spotify",
    name: "Spotify Premium",
    price: 11.99,
    currency: "USD",
    frequency: "monthly",
    category: "entertainment",
    paymentMethod: "PayPal",
    status: "active",
    startDate: "2025-11-20",
    renewalDate: "2026-10-20"
  },
  {
    id: "sub-copilot",
    name: "GitHub Copilot",
    price: 10.0,
    currency: "USD",
    frequency: "monthly",
    category: "technology",
    paymentMethod: "Credit Card",
    status: "active",
    startDate: "2026-01-01",
    renewalDate: "2026-11-01"
  },
  {
    id: "sub-disney",
    name: "Disney+",
    price: 13.99,
    currency: "USD",
    frequency: "monthly",
    category: "entertainment",
    paymentMethod: "Google Pay",
    status: "active",
    startDate: "2026-04-05",
    renewalDate: "2026-10-15"
  },
  {
    id: "sub-medium",
    name: "Medium Member",
    price: 5.0,
    currency: "USD",
    frequency: "monthly",
    category: "news",
    paymentMethod: "Apple Pay",
    status: "active",
    startDate: "2026-06-15",
    renewalDate: "2026-10-25"
  }
];

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("bp_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.message || data?.error || `HTTP error ${res.status}`;
    throw new Error(errorMsg);
  }
  return data;
}

export const api = {
  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await fetch("http://localhost:5500/api", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  },

  signUp: async (userData: { name: string; email: string; password: string }) => {
    return request<{ success: boolean; data: { token: string; user: User } }>("/auth/sign-up", {
      method: "POST",
      body: JSON.stringify(userData)
    });
  },

  signIn: async (credentials: { email: string; password: string }) => {
    return request<{ success: boolean; data: { token: string; user: User } }>("/auth/sign-in", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
  },

  signOut: async () => {
    return request<{ success: boolean }>("/auth/sign-out", { method: "POST" });
  },

  getUserSubscriptions: async (userId: string): Promise<Subscription[]> => {
    const res = await request<{ success: boolean; data: Subscription[] }>(`/subscriptions/user/${userId}`);
    return res.data || [];
  },

  getUpcomingRenewals: async (): Promise<Subscription[]> => {
    const res = await request<{ success: boolean; data: Subscription[] }>("/subscriptions/upcoming-renewals");
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
    const res = await request<{ success: boolean; data: Subscription }>(`/subscriptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(subData)
    });
    return res.data;
  },

  cancelSubscription: async (id: string): Promise<Subscription> => {
    const res = await request<{ success: boolean; data: Subscription }>(`/subscriptions/${id}/cancel`, {
      method: "PUT"
    });
    return res.data;
  },

  deleteSubscription: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/subscriptions/${id}`, {
      method: "DELETE"
    });
  },

  getAnalyticsAudit: async (): Promise<AnalyticsData> => {
    const res = await request<{ success: boolean; data: AnalyticsData }>("/analytics/audit");
    return res.data;
  }
};
