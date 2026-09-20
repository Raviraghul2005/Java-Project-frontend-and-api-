/**
 * Reactive State Management for Bill Pilot Frontend
 */

export const state = {
  user: null,
  token: null,
  subscriptions: [],
  activeFilter: "all",
  searchQuery: "",
  sortBy: "renewal-asc",
  isBackendConnected: false,

  init() {
    this.token = localStorage.getItem("bp_token");
    const cachedUser = localStorage.getItem("bp_user");
    if (cachedUser) {
      try {
        this.user = JSON.parse(cachedUser);
      } catch {
        this.user = null;
      }
    }
  },

  setAuth(user, token) {
    this.user = user;
    this.token = token;
    if (user && token) {
      localStorage.setItem("bp_user", JSON.stringify(user));
      localStorage.setItem("bp_token", token);
    } else {
      localStorage.removeItem("bp_user");
      localStorage.removeItem("bp_token");
    }
  },

  clearAuth() {
    this.setAuth(null, null);
    this.subscriptions = [];
  },

  getFilteredSubscriptions() {
    return this.subscriptions.filter(sub => {
      const matchesFilter = this.activeFilter === "all" || 
        sub.category?.toLowerCase() === this.activeFilter.toLowerCase();
      
      const q = this.searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        sub.name?.toLowerCase().includes(q) || 
        sub.paymentMethod?.toLowerCase().includes(q) ||
        sub.category?.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    }).sort((a, b) => {
      switch (this.sortBy) {
        case "price-desc":
          return (b.price || 0) - (a.price || 0);
        case "price-asc":
          return (a.price || 0) - (b.price || 0);
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "renewal-asc":
        default:
          if (!a.renewalDate) return 1;
          if (!b.renewalDate) return -1;
          return new Date(a.renewalDate) - new Date(b.renewalDate);
      }
    });
  },

  getMetrics() {
    let monthlyTotal = 0;
    let activeCount = 0;
    let renewingSoonCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    this.subscriptions.forEach(sub => {
      if (sub.status === "active") {
        activeCount++;

        // Monthly normalized price
        let normalizedPrice = sub.price || 0;
        if (sub.frequency === "yearly") normalizedPrice = normalizedPrice / 12;
        if (sub.frequency === "weekly") normalizedPrice = normalizedPrice * 4.33;
        if (sub.frequency === "daily") normalizedPrice = normalizedPrice * 30;
        monthlyTotal += normalizedPrice;

        if (sub.renewalDate) {
          const rDate = new Date(sub.renewalDate);
          if (rDate >= today && rDate <= in7Days) {
            renewingSoonCount++;
          }
        }
      }
    });

    return {
      monthlyTotal: monthlyTotal.toFixed(2),
      activeCount,
      renewingSoonCount
    };
  }
};
