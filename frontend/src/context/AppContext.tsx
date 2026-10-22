"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Subscription, User, AnalyticsData, CreateSubscriptionInput } from "@/types";
import { api, ApiError, setUnauthorizedHandler } from "@/lib/api";
import { clearSession, loadSession, purgeLegacyCaches, saveSession, StoredSession } from "@/lib/auth";
import { buildDemoSubscriptions } from "@/lib/demo";
import { validateImport } from "@/lib/importSchema";

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info";
}

interface AppContextType {
  user: User | null;
  token: string | null;
  subscriptions: Subscription[];
  analytics: AnalyticsData | null;
  isBackendConnected: boolean;
  isLoading: boolean;
  /** Set when the last data load failed; the previous data stays on screen and `refreshAll` retries. */
  loadError: string | null;
  activeFilter: string;
  searchQuery: string;
  sortBy: string;
  toasts: ToastMessage[];
  setActiveFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: string) => void;
  addToast: (text: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  createSub: (data: CreateSubscriptionInput) => Promise<boolean>;
  updateSub: (id: string, data: Partial<CreateSubscriptionInput>) => Promise<boolean>;
  cancelSub: (id: string) => Promise<boolean>;
  reactivateSub: (id: string) => Promise<boolean>;
  deleteSub: (id: string) => Promise<boolean>;
  importSubs: (parsed: unknown) => Promise<boolean>;
  resetToDemo: () => Promise<void>;
  clearAllSubs: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SERVER_UNREACHABLE =
  "Cannot reach the Bill Pilot server. Check that the backend is running, then retry.";

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("renewal-asc");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // The current session lives in a ref as well as in state so async callbacks never read a stale closure.
  const sessionRef = useRef<StoredSession | null>(null);
  // Incremented per refresh; a response that is no longer the latest request is discarded.
  const refreshSeq = useRef(0);

  const addToast = useCallback((text: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applySession = useCallback((session: StoredSession | null) => {
    sessionRef.current = session;
    setUser(session ? session.user : null);
    setToken(session ? session.token : null);
  }, []);

  const refreshAll = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const session = sessionRef.current;

    const connected = await api.checkHealth();
    if (seq !== refreshSeq.current) return;
    setIsBackendConnected(connected);

    if (!session) {
      setSubscriptions([]);
      setAnalytics(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    if (!connected) {
      setLoadError(SERVER_UNREACHABLE);
      setIsLoading(false);
      return;
    }

    try {
      const [subs, audit] = await Promise.all([
        api.getUserSubscriptions(session.user.id),
        api.getAnalyticsAudit()
      ]);
      if (seq !== refreshSeq.current) return;
      setSubscriptions(Array.isArray(subs) ? subs : []);
      setAnalytics(audit);
      setLoadError(null);
    } catch (err) {
      if (seq !== refreshSeq.current) return;
      // A 401 already signed the user out via the unauthorized handler.
      if (err instanceof ApiError && err.status === 0) {
        // status 0 = the request never reached the server (network down / timeout)
        setLoadError(SERVER_UNREACHABLE);
      } else if (!(err instanceof ApiError && err.status === 401)) {
        setLoadError(errorMessage(err, "Could not load your subscriptions."));
      }
    }
    setIsLoading(false);
  }, []);

  /** Ends the session locally: wipes stored data and every piece of per-user UI state. */
  const endSession = useCallback(
    (message: string) => {
      // Invalidate any in-flight load for the old user. That load now returns early without touching
      // state, so this is also responsible for ending the loading state (otherwise a 401 during the first
      // load would leave the app on the spinner forever instead of sending the user to sign in).
      refreshSeq.current++;
      clearSession();
      applySession(null);
      setSubscriptions([]);
      setAnalytics(null);
      setLoadError(null);
      setIsLoading(false);
      setActiveFilter("all");
      setSearchQuery("");
      setSortBy("renewal-asc");
      addToast(message, "info");
    },
    [applySession, addToast]
  );

  // Restore a saved (non-expired) session on first load, and sign out whenever the API rejects the token.
  useEffect(() => {
    // Browser storage is only readable after mount, so restoring the session has to happen here.
    // Done inside an async function so the first state updates are not synchronous in the effect body.
    const restore = async () => {
      purgeLegacyCaches();
      applySession(await Promise.resolve(loadSession()));
      await refreshAll();
    };
    void restore();
  }, [applySession, refreshAll]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionRef.current) endSession("Your session expired. Please sign in again.");
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  const startSession = async (session: StoredSession, welcome: string) => {
    saveSession(session);
    applySession(session);
    addToast(welcome);
    await refreshAll();
  };

  const ensureServer = async (): Promise<boolean> => {
    const connected = await api.checkHealth();
    setIsBackendConnected(connected);
    if (!connected) {
      addToast("Cannot reach the Bill Pilot server. Start the backend and try again.", "error");
    }
    return connected;
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    if (!(await ensureServer())) return false;
    try {
      const res = await api.signIn({ email, password: pass });
      if (res.data?.token && res.data?.user) {
        await startSession({ token: res.data.token, user: res.data.user }, `Signed in as ${res.data.user.name}`);
        return true;
      }
      addToast("Failed to sign in", "error");
    } catch (err) {
      addToast(errorMessage(err, "Failed to sign in"), "error");
    }
    return false;
  };

  const register = async (name: string, email: string, pass: string): Promise<boolean> => {
    if (!(await ensureServer())) return false;
    try {
      const res = await api.signUp({ name, email, password: pass });
      if (res.data?.token && res.data?.user) {
        await startSession({ token: res.data.token, user: res.data.user }, "Account registered successfully");
        return true;
      }
      addToast("Registration failed", "error");
    } catch (err) {
      addToast(errorMessage(err, "Registration failed"), "error");
    }
    return false;
  };

  const logout = () => {
    // Best effort: the API is stateless, so signing out is complete once local state is wiped.
    api.signOut().catch(() => undefined);
    endSession("Signed out successfully");
  };

  /** Runs a mutation, reports the outcome, and reloads server state. */
  const mutate = async (action: () => Promise<unknown>, success: string, failure: string, type: "success" | "info" = "success") => {
    try {
      await action();
      addToast(success, type);
      await refreshAll();
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        addToast(errorMessage(err, failure), "error");
      }
      return false;
    }
  };

  const createSub = (data: CreateSubscriptionInput) =>
    mutate(() => api.createSubscription(data), `Added "${data.name}"`, "Could not create subscription");

  const updateSub = (id: string, data: Partial<CreateSubscriptionInput>) =>
    mutate(() => api.updateSubscription(id, data), "Subscription updated", "Could not update subscription");

  const cancelSub = (id: string) =>
    mutate(() => api.cancelSubscription(id), "Subscription marked as cancelled", "Failed to cancel subscription", "info");

  const reactivateSub = (id: string) =>
    mutate(() => api.updateSubscription(id, { status: "active" }), "Subscription reactivated", "Failed to reactivate subscription");

  const deleteSub = (id: string) =>
    mutate(() => api.deleteSubscription(id), "Subscription deleted", "Failed to delete subscription", "info");

  const importSubs = async (parsed: unknown): Promise<boolean> => {
    const result = validateImport(parsed);
    if ("error" in result) {
      addToast(`Invalid import: ${result.error}`, "error");
      return false;
    }
    if (result.valid.length === 0) {
      addToast("No valid subscription records found in file", "error");
      return false;
    }

    let created = 0;
    let failed = 0;
    for (const sub of result.valid) {
      try {
        await api.createSubscription(sub);
        created++;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return false;
        failed++;
      }
    }
    await refreshAll();

    const skipped = result.rejected.length + failed;
    if (created === 0) {
      addToast("Import failed: no records could be saved", "error");
      return false;
    }
    addToast(
      skipped > 0
        ? `Imported ${created} subscriptions (${skipped} skipped as invalid or failed)`
        : `Successfully imported ${created} subscriptions`,
      skipped > 0 ? "info" : "success"
    );
    return true;
  };

  const resetToDemo = async () => {
    const existing = new Set(subscriptions.map((s) => s.name.trim().toLowerCase()));
    const toCreate = buildDemoSubscriptions().filter((s) => !existing.has(s.name.toLowerCase()));
    if (toCreate.length === 0) {
      addToast("Demo subscriptions are already on your board", "info");
      return;
    }
    let created = 0;
    for (const sub of toCreate) {
      try {
        await api.createSubscription(sub);
        created++;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
      }
    }
    await refreshAll();
    addToast(
      created === toCreate.length ? "Loaded demo subscription fleet" : `Loaded ${created} of ${toCreate.length} demo subscriptions`,
      created === 0 ? "error" : "success"
    );
  };

  const clearAllSubs = async () => {
    let failed = 0;
    for (const s of subscriptions) {
      try {
        await api.deleteSubscription(s.id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        failed++;
      }
    }
    await refreshAll();
    if (failed > 0) {
      addToast(`${failed} subscription${failed === 1 ? "" : "s"} could not be deleted`, "error");
    } else {
      addToast("All subscriptions cleared", "info");
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        subscriptions,
        analytics,
        isBackendConnected,
        isLoading,
        loadError,
        activeFilter,
        searchQuery,
        sortBy,
        toasts,
        setActiveFilter,
        setSearchQuery,
        setSortBy,
        addToast,
        removeToast,
        login,
        register,
        logout,
        createSub,
        updateSub,
        cancelSub,
        reactivateSub,
        deleteSub,
        importSubs,
        resetToDemo,
        clearAllSubs,
        refreshAll
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
