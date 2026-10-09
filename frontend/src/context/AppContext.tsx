"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Subscription, User, AnalyticsData, CreateSubscriptionInput, Frequency } from "@/types";
import { api, SEED_SUBSCRIPTIONS } from "@/lib/api";

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
  importSubs: (imported: Subscription[]) => boolean;
  resetToDemo: () => void;
  clearAllSubs: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export function calculateRenewalDate(startDateStr: string, freq: Frequency): string {
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  if (freq === "daily") d.setDate(d.getDate() + 1);
  else if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "monthly") d.setDate(d.getDate() + 30);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("renewal-asc");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  const toMonthly = useCallback((price: number, freq: Frequency): number => {
    if (!price) return 0;
    if (freq === "yearly") return price / 12;
    if (freq === "weekly") return price * 4.33;
    if (freq === "daily") return price * 30;
    return price;
  }, []);

  // Compute local analytics fallback matching Spring Boot AnalyticsService
  const computeLocalAnalytics = useCallback((subs: Subscription[]): AnalyticsData => {
    const active = subs.filter((s) => s.status === "active");
    let totalMonthly = 0;
    active.forEach((s) => {
      totalMonthly += toMonthly(s.price, s.frequency);
    });

    const catMap = new Map<string, Subscription[]>();
    active.forEach((s) => {
      const arr = catMap.get(s.category) || [];
      arr.push(s);
      catMap.set(s.category, arr);
    });

    const redundancies: AnalyticsData["redundancies"] = [];
    let redCount = 0;
    let potentialSav = 0;

    catMap.forEach((catSubs, catName) => {
      if (catSubs.length > 1) {
        redCount += catSubs.length - 1;
        const catTotal = catSubs.reduce((acc, c) => acc + toMonthly(c.price, c.frequency), 0);
        const maxSingle = Math.max(...catSubs.map((c) => toMonthly(c.price, c.frequency)));
        const sav = Math.max(0, (catTotal - maxSingle) * 12);
        potentialSav += sav;

        redundancies.push({
          category: catName,
          title: `${catName.toUpperCase()} Stack Saturation`,
          serviceNames: catSubs.map((c) => c.name),
          monthlySpend: Number(catTotal.toFixed(2)),
          annualSpend: Number((catTotal * 12).toFixed(2)),
          potentialAnnualSavings: Math.round(sav),
          recommendation: `Consider sequential monthly rotation to eliminate duplicate functional coverage.`
        });
      }
    });

    const vampireProjections = active.map((s) => {
      const m = toMonthly(s.price, s.frequency);
      const oneY = Math.round(m * 12);
      const threeY = Math.round(m * 36);
      const fiveY = Math.round(m * 60);
      const opp = Math.round(m * 71.59);
      return {
        subscriptionId: s.id,
        name: s.name,
        category: s.category,
        monthlyCost: Number(m.toFixed(2)),
        oneYearSpend: oneY,
        threeYearSpend: threeY,
        fiveYearSpend: fiveY,
        fiveYearOpportunityCost: opp,
        highDrainRisk: fiveY >= 600
      };
    }).sort((a, b) => b.fiveYearOpportunityCost - a.fiveYearOpportunityCost);

    // Compute collisions for next 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dateMap = new Map<string, Subscription[]>();

    active.forEach((s) => {
      if (s.renewalDate) {
        const rDate = new Date(s.renewalDate);
        if (rDate >= today && rDate <= in30Days) {
          const dateStr = s.renewalDate;
          const list = dateMap.get(dateStr) || [];
          list.push(s);
          dateMap.set(dateStr, list);
        }
      }
    });

    const collisionTimeline: AnalyticsData["collisionTimeline"] = [];
    let collisionDayCount = 0;
    dateMap.forEach((daySubs, dStr) => {
      const totalCost = daySubs.reduce((acc, s) => acc + s.price, 0);
      const count = daySubs.length;
      const isRisk = count >= 2 || totalCost >= 40;
      if (isRisk) collisionDayCount++;

      collisionTimeline.push({
        date: dStr,
        count,
        totalCost: Number(totalCost.toFixed(2)),
        serviceNames: daySubs.map((s) => s.name),
        collisionRisk: isRisk
      });
    });
    collisionTimeline.sort((a, b) => a.date.localeCompare(b.date));

    // Subscription Fatigue Index (SFI) formula
    const rawScore = active.length * 4.5 + Math.min(30, totalMonthly / 15) + redCount * 12 + Math.min(18, collisionDayCount * 6);
    const score = active.length === 0 ? 0 : Math.min(100, Math.max(8, Math.round(rawScore)));

    let level = "OPTIMAL";
    let color = "#10b981";
    let interp = active.length === 0
      ? "No active subscriptions. Clean slate with zero recurring fatigue."
      : "Minimal cognitive friction. Subscriptions are lean and well-curated.";

    if (score > 30 && score <= 60) {
      level = "MODERATE";
      color = "#f59e0b";
      interp = "Controlled commitment load. Minor category clusters detected.";
    } else if (score > 60 && score <= 80) {
      level = "ELEVATED";
      color = "#f97316";
      interp = "Subscription fatigue emerging. High redundancy in core categories.";
    } else if (score > 80) {
      level = "BURNOUT";
      color = "#ef4444";
      interp = "Severe subscription saturation. Heavy recurring leakage and lost opportunity cost.";
    }

    return {
      totalMonthlySpend: Number(totalMonthly.toFixed(2)),
      totalAnnualSpend: Number((totalMonthly * 12).toFixed(2)),
      activeCount: active.length,
      fatigueIndex: score,
      fatigueLevel: level,
      fatigueColor: color,
      fatigueInterpretation: interp,
      redundancyCount: redCount,
      potentialAnnualSavings: Math.round(potentialSav),
      redundancies,
      total5YearOpportunityCost: vampireProjections.reduce((a, b) => a + b.fiveYearOpportunityCost, 0),
      vampireProjections,
      collisionTimeline,
      categoryBreakdowns: Array.from(catMap.entries()).map(([k, v]) => {
        const catSum = v.reduce((a, b) => a + toMonthly(b.price, b.frequency), 0);
        return {
          category: k as any,
          categoryName: k,
          monthlySpend: Number(catSum.toFixed(2)),
          percentage: Number(((catSum / (totalMonthly || 1)) * 100).toFixed(1)),
          count: v.length
        };
      })
    };
  }, [toMonthly]);

  const refreshAll = useCallback(async () => {
    const connected = await api.checkHealth();
    setIsBackendConnected(connected);

    const savedToken = localStorage.getItem("bp_token");
    const savedUserStr = localStorage.getItem("bp_user");
    let currentUser = user;

    if (savedToken && savedUserStr && !currentUser) {
      try {
        currentUser = JSON.parse(savedUserStr);
        setUser(currentUser);
        setToken(savedToken);
      } catch {
        // ignore
      }
    }

    if (!currentUser) {
      setSubscriptions([]);
      setAnalytics(null);
      setIsLoading(false);
      return;
    }

    const storageKey = `bp_subs_${currentUser.id}`;

    if (connected && currentUser?.id) {
      try {
        const subs = await api.getUserSubscriptions(currentUser.id);
        const list = Array.isArray(subs) ? subs : [];
        setSubscriptions(list);

        try {
          const audit = await api.getAnalyticsAudit();
          setAnalytics(audit);
        } catch {
          setAnalytics(computeLocalAnalytics(list));
        }
      } catch (e: any) {
        console.warn("Backend error, using cached user data", e);
        const saved = localStorage.getItem(storageKey);
        const list = saved ? JSON.parse(saved) : [];
        setSubscriptions(list);
        setAnalytics(computeLocalAnalytics(list));
      }
    } else {
      // Standalone authenticated session
      const saved = localStorage.getItem(storageKey);
      const list = saved ? JSON.parse(saved) : [];
      setSubscriptions(list);
      setAnalytics(computeLocalAnalytics(list));
    }
    setIsLoading(false);
  }, [user, computeLocalAnalytics]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      if (isBackendConnected) {
        try {
          const res = await api.signIn({ email, password: pass });
          if (res.data?.token && res.data?.user) {
            setUser(res.data.user);
            setToken(res.data.token);
            localStorage.setItem("bp_token", res.data.token);
            localStorage.setItem("bp_user", JSON.stringify(res.data.user));
            addToast(`Signed in as ${res.data.user.name}`);
            await refreshAll();
            return true;
          }
        } catch (backendErr: any) {
          if (email === "demo@billpilot.com") {
            try {
              const reg = await api.signUp({ name: "Demo User", email, password: pass });
              if (reg.data?.token && reg.data?.user) {
                setUser(reg.data.user);
                setToken(reg.data.token);
                localStorage.setItem("bp_token", reg.data.token);
                localStorage.setItem("bp_user", JSON.stringify(reg.data.user));
                addToast(`Signed in as ${reg.data.user.name}`);
                await refreshAll();
                return true;
              }
            } catch {
              // fallback below
            }
          }
          throw backendErr;
        }
      } else {
        const demoUser: User = { id: "demo-user-id", name: "Demo User", email };
        setUser(demoUser);
        setToken("demo-jwt-token");
        localStorage.setItem("bp_token", "demo-jwt-token");
        localStorage.setItem("bp_user", JSON.stringify(demoUser));
        addToast(`Signed in as ${demoUser.name}`);
        await refreshAll();
        return true;
      }
    } catch (err: any) {
      if (email === "demo@billpilot.com") {
        const demoUser: User = { id: "demo-user-id", name: "Demo User", email };
        setUser(demoUser);
        setToken("demo-jwt-token");
        localStorage.setItem("bp_token", "demo-jwt-token");
        localStorage.setItem("bp_user", JSON.stringify(demoUser));
        addToast(`Signed in as ${demoUser.name}`);
        await refreshAll();
        return true;
      }
      addToast(err.message || "Failed to sign in", "error");
    }
    return false;
  };

  const register = async (name: string, email: string, pass: string): Promise<boolean> => {
    try {
      if (isBackendConnected) {
        const res = await api.signUp({ name, email, password: pass });
        if (res.data?.token && res.data?.user) {
          setUser(res.data.user);
          setToken(res.data.token);
          localStorage.setItem("bp_token", res.data.token);
          localStorage.setItem("bp_user", JSON.stringify(res.data.user));
          addToast("Account registered successfully");
          await refreshAll();
          return true;
        }
      } else {
        const demoUser: User = { id: "demo-" + Date.now(), name, email };
        setUser(demoUser);
        setToken("demo-token");
        localStorage.setItem("bp_token", "demo-token");
        localStorage.setItem("bp_user", JSON.stringify(demoUser));
        addToast("Account created");
        await refreshAll();
        return true;
      }
    } catch (err: any) {
      addToast(err.message || "Registration failed", "error");
    }
    return false;
  };

  const getStorageKey = useCallback((u: User | null): string => {
    return u?.id ? `bp_subs_${u.id}` : "bp_subs_guest";
  }, []);

  const logout = () => {
    setUser(null);
    setToken(null);
    setSubscriptions([]);
    setAnalytics(null);
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_user");
    localStorage.removeItem("bp_local_subs");
    addToast("Signed out successfully", "info");
    refreshAll();
  };

  const createSub = async (data: CreateSubscriptionInput): Promise<boolean> => {
    try {
      const renewalDate = data.renewalDate || calculateRenewalDate(data.startDate, data.frequency);

      if (isBackendConnected && user) {
        await api.createSubscription({ ...data, renewalDate });
      } else {
        const newSub: Subscription = {
          id: "sub-" + Date.now(),
          ...data,
          renewalDate,
          status: "active",
          currency: data.currency || "USD"
        };
        const updated = [newSub, ...subscriptions];
        setSubscriptions(updated);
        localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
        setAnalytics(computeLocalAnalytics(updated));
      }
      addToast(`Added "${data.name}"`);
      await refreshAll();
      return true;
    } catch (err: any) {
      addToast(err.message || "Could not create subscription", "error");
      return false;
    }
  };

  const updateSub = async (id: string, data: Partial<CreateSubscriptionInput>): Promise<boolean> => {
    try {
      if (isBackendConnected && user) {
        await api.updateSubscription(id, data);
      } else {
        const updated = subscriptions.map((s) => {
          if (s.id !== id) return s;
          const merged = { ...s, ...data };
          if (!data.renewalDate && (data.startDate || data.frequency)) {
            merged.renewalDate = calculateRenewalDate(merged.startDate, merged.frequency);
          }
          return merged;
        });
        setSubscriptions(updated);
        localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
        setAnalytics(computeLocalAnalytics(updated));
      }
      addToast("Subscription updated");
      await refreshAll();
      return true;
    } catch (err: any) {
      addToast(err.message || "Could not update subscription", "error");
      return false;
    }
  };

  const cancelSub = async (id: string): Promise<boolean> => {
    try {
      if (isBackendConnected && user) {
        await api.cancelSubscription(id);
      } else {
        const updated = subscriptions.map((s) =>
          s.id === id ? { ...s, status: "cancelled" as const } : s
        );
        setSubscriptions(updated);
        localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
        setAnalytics(computeLocalAnalytics(updated));
      }
      addToast("Subscription marked as cancelled", "info");
      await refreshAll();
      return true;
    } catch (err: any) {
      addToast(err.message || "Failed to cancel subscription", "error");
      return false;
    }
  };

  const reactivateSub = async (id: string): Promise<boolean> => {
    try {
      if (isBackendConnected && user) {
        await api.updateSubscription(id, { status: "active" });
      } else {
        const updated = subscriptions.map((s) =>
          s.id === id ? { ...s, status: "active" as const } : s
        );
        setSubscriptions(updated);
        localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
        setAnalytics(computeLocalAnalytics(updated));
      }
      addToast("Subscription reactivated", "success");
      await refreshAll();
      return true;
    } catch (err: any) {
      addToast(err.message || "Failed to reactivate subscription", "error");
      return false;
    }
  };

  const deleteSub = async (id: string): Promise<boolean> => {
    try {
      if (isBackendConnected && user) {
        await api.deleteSubscription(id);
      } else {
        const updated = subscriptions.filter((s) => s.id !== id);
        setSubscriptions(updated);
        localStorage.setItem(getStorageKey(user), JSON.stringify(updated));
        setAnalytics(computeLocalAnalytics(updated));
      }
      addToast("Subscription deleted", "info");
      await refreshAll();
      return true;
    } catch (err: any) {
      addToast(err.message || "Failed to delete subscription", "error");
      return false;
    }
  };

  const importSubs = (imported: Subscription[]): boolean => {
    if (!Array.isArray(imported) || imported.length === 0) {
      addToast("Invalid JSON: Expected an array of subscriptions", "error");
      return false;
    }

    // Validate objects
    const validSubs = imported.filter((s) => s.name && s.price !== undefined);
    if (validSubs.length === 0) {
      addToast("No valid subscription records found in file", "error");
      return false;
    }

    setSubscriptions(validSubs);
    localStorage.setItem(getStorageKey(user), JSON.stringify(validSubs));
    setAnalytics(computeLocalAnalytics(validSubs));
    addToast(`Successfully imported ${validSubs.length} subscriptions`);
    return true;
  };

  const resetToDemo = () => {
    const storageKey = getStorageKey(user);
    setSubscriptions(SEED_SUBSCRIPTIONS);
    localStorage.setItem(storageKey, JSON.stringify(SEED_SUBSCRIPTIONS));
    setAnalytics(computeLocalAnalytics(SEED_SUBSCRIPTIONS));
    addToast("Loaded demo subscription fleet");
  };

  const clearAllSubs = async () => {
    if (isBackendConnected && user) {
      for (const s of subscriptions) {
        try {
          await api.deleteSubscription(s.id);
        } catch {
          // ignore
        }
      }
    }
    const storageKey = getStorageKey(user);
    setSubscriptions([]);
    localStorage.removeItem(storageKey);
    localStorage.removeItem("bp_local_subs");
    setAnalytics(computeLocalAnalytics([]));
    addToast("All subscriptions cleared", "info");
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
