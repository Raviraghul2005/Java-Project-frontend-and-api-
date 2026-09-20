/**
 * Bill Pilot Backend API Client (Spring Boot 3.4 API on port 5500)
 */

export const API_BASE = window.location.port === "5500"
  ? "/api/v1"
  : "http://localhost:5500/api/v1";

function getAuthHeader() {
  const token = localStorage.getItem("bp_token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `HTTP error ${res.status}`;
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error(`API Error on [${options.method || "GET"} ${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // Server Health
  checkHealth: async () => {
    try {
      const base = window.location.port === "5500" ? "" : "http://localhost:5500";
      const res = await fetch(`${base}/api`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Auth
  signUp: (userData) => request("/auth/sign-up", { method: "POST", body: JSON.stringify(userData) }),
  signIn: (credentials) => request("/auth/sign-in", { method: "POST", body: JSON.stringify(credentials) }),
  signOut: () => request("/auth/sign-out", { method: "POST" }),

  // Subscriptions
  getUserSubscriptions: (userId) => request(`/subscriptions/user/${userId}`),
  getUpcomingRenewals: () => request("/subscriptions/upcoming-renewals"),
  getSubscription: (id) => request(`/subscriptions/${id}`),
  createSubscription: (subData) => request("/subscriptions", { method: "POST", body: JSON.stringify(subData) }),
  updateSubscription: (id, subData) => request(`/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(subData) }),
  cancelSubscription: (id) => request(`/subscriptions/${id}/cancel`, { method: "PUT" }),
  deleteSubscription: (id) => request(`/subscriptions/${id}`, { method: "DELETE" }),
};
