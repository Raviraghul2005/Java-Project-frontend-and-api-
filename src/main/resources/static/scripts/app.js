/**
 * Bill Pilot Frontend Application Controller
 * Renders Broadside-styled components and connects with Spring Boot backend
 */

import { api } from "./api.js";
import { state } from "./state.js";
import { PRESET_SUBSCRIPTIONS, findLogoForSubscription } from "./catalog.js";

// DOM Elements
const dom = {
  backendStatus: document.getElementById("backendStatus"),
  userMeta: document.getElementById("userMeta"),
  authBtn: document.getElementById("authBtn"),
  metricMonthly: document.getElementById("metricMonthly"),
  metricActive: document.getElementById("metricActive"),
  metricSoon: document.getElementById("metricSoon"),
  subscriptionsGrid: document.getElementById("subscriptionsGrid"),
  emptyState: document.getElementById("emptyState"),
  filterPills: document.querySelectorAll(".filter-pill"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  newSubBtn: document.getElementById("newSubBtn"),
  subModal: document.getElementById("subModal"),
  subModalTitle: document.getElementById("subModalTitle"),
  subForm: document.getElementById("subForm"),
  subIdInput: document.getElementById("subIdInput"),
  presetGrid: document.getElementById("presetGrid"),
  authModal: document.getElementById("authModal"),
  authForm: document.getElementById("authForm"),
  authModeTitle: document.getElementById("authModeTitle"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  authTogglePrompt: document.getElementById("authTogglePrompt"),
  nameGroup: document.getElementById("nameGroup"),
  toastBox: document.getElementById("toastBox"),
};

let isRegisterMode = false;

// Format dates nicely
function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDaysRemaining(renewalDateStr) {
  if (!renewalDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(renewalDateStr);
  target.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Generate stylish initials for subscriptions without logos
export function getSubscriptionInitials(name) {
  if (!name) return "BP";
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return (clean[0] || "B").toUpperCase();
}

// Render brand logo or editorial monogram badge
export function renderBrandBadge(name, category, logoUrl) {
  const cat = (category || "other").toLowerCase();
  const initials = getSubscriptionInitials(name);

  if (logoUrl) {
    return `
      <div class="brand-logo-frame">
        <img src="${logoUrl}" alt="${name}" onerror="this.parentElement.className='brand-logo-frame brand-logo-monogram cat-${cat}'; this.parentElement.innerHTML='<span class=\\'brand-monogram-text\\'>${initials}</span>';">
      </div>
    `;
  }

  return `
    <div class="brand-logo-frame brand-logo-monogram cat-${cat}">
      <span class="brand-monogram-text">${initials}</span>
    </div>
  `;
}

// Show Toast notification
export function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "rust" : ""}`;
  toast.innerHTML = `<span>${isError ? "⚠️" : "⚡"}</span> <span>${message}</span>`;
  dom.toastBox.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Render Metrics
function renderMetrics() {
  const metrics = state.getMetrics();
  dom.metricMonthly.textContent = `$${metrics.monthlyTotal}`;
  dom.metricActive.textContent = `${metrics.activeCount} SERVICES`;
  dom.metricSoon.textContent = `${metrics.renewingSoonCount} RENEWALS`;
}

// Render Subscriptions Grid
function renderSubscriptions() {
  const subs = state.getFilteredSubscriptions();
  dom.subscriptionsGrid.innerHTML = "";

  if (subs.length === 0) {
    dom.emptyState.style.display = "block";
    dom.subscriptionsGrid.style.display = "none";
    return;
  }

  dom.emptyState.style.display = "none";
  dom.subscriptionsGrid.style.display = "grid";

  subs.forEach((sub, index) => {
    const card = document.createElement("div");
    const isCancelled = sub.status === "cancelled";
    card.className = `sub-card ${isCancelled ? "cancelled" : ""}`;

    const daysLeft = getDaysRemaining(sub.renewalDate);
    const logoUrl = findLogoForSubscription(sub.name);
    const brandBadgeHtml = renderBrandBadge(sub.name, sub.category, logoUrl);
    const ghostIndex = String(index + 1).padStart(2, "0");

    let renewalText = "";
    if (isCancelled) {
      renewalText = "Subscription is <strong>Cancelled</strong>";
    } else if (daysLeft !== null) {
      if (daysLeft < 0) {
        renewalText = `<strong style="color:var(--rust)">Expired ${Math.abs(daysLeft)} days ago</strong>`;
      } else if (daysLeft === 0) {
        renewalText = `<strong style="color:var(--rust)">Renews Today!</strong>`;
      } else if (daysLeft === 1) {
        renewalText = `<strong style="color:var(--rust)">Renews Tomorrow!</strong>`;
      } else {
        renewalText = `Renews in <strong>${daysLeft} days</strong> (${formatDate(sub.renewalDate)})`;
      }
    } else {
      renewalText = "Renewal date not set";
    }

    card.innerHTML = `
      <div class="ghost-num">${ghostIndex}</div>

      <div>
        <div class="card-top">
          <div class="brand-badge">
            ${brandBadgeHtml}
            <div class="card-title-group">
              <span class="sub-name">${sub.name}</span>
              <span class="sub-method">${sub.paymentMethod || "Direct Payment"}</span>
            </div>
          </div>
          <span class="tag tag-${sub.status || 'active'}">${sub.status || 'ACTIVE'}</span>
        </div>

        <div class="card-pricing">
          <div class="price-main">
            $${Number(sub.price || 0).toFixed(2)}
            <span class="price-freq">/${sub.frequency || 'mo'}</span>
          </div>
        </div>

        <div class="renewal-box">
          <div class="renewal-eyebrow">
            <span>RENEWAL SCHEDULE</span>
            <span>${sub.category || 'General'}</span>
          </div>
          <div class="renewal-days">
            ${renewalText}
          </div>
        </div>
      </div>

      <div class="card-actions">
        <span class="tag tag-rust">${sub.currency || 'USD'}</span>
        <div class="action-btns">
          ${!isCancelled ? `<button class="btn btn-ghost btn-sm btn-cancel" data-id="${sub.id}">Cancel</button>` : ''}
          <button class="btn btn-ghost btn-sm btn-edit" data-id="${sub.id}">Edit</button>
          <button class="btn btn-ghost btn-sm btn-delete" data-id="${sub.id}" style="color:var(--rust); border-color:var(--rust-tint);">✕</button>
        </div>
      </div>
    `;

    // Bind action listeners
    const cancelBtn = card.querySelector(".btn-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => handleCancelSubscription(sub.id));
    }
    card.querySelector(".btn-delete").addEventListener("click", () => handleDeleteSubscription(sub.id));
    card.querySelector(".btn-edit").addEventListener("click", () => openEditModal(sub));

    dom.subscriptionsGrid.appendChild(card);
  });
}

// Populate Preset Drawer
function renderPresets() {
  dom.presetGrid.innerHTML = "";
  PRESET_SUBSCRIPTIONS.forEach(preset => {
    const chip = document.createElement("div");
    chip.className = "preset-chip";
    chip.innerHTML = `
      <img src="${preset.logo}" alt="${preset.name}" onerror="this.style.display='none'">
      <div class="preset-chip-name">${preset.name}</div>
      <div class="preset-chip-price">$${preset.price}/${preset.frequency}</div>
    `;
    chip.addEventListener("click", () => {
      document.getElementById("subName").value = preset.name;
      document.getElementById("subPrice").value = preset.price;
      document.getElementById("subCurrency").value = preset.currency;
      document.getElementById("subFreq").value = preset.frequency;
      document.getElementById("subCat").value = preset.category;
      document.getElementById("subPayment").value = preset.paymentMethod;
      showToast(`Selected preset: ${preset.name}`);
    });
    dom.presetGrid.appendChild(chip);
  });
}

// Load Subscriptions from Backend
async function fetchSubscriptions() {
  if (!state.user || !state.token) {
    renderSubscriptions();
    renderMetrics();
    return;
  }

  try {
    const res = await api.getUserSubscriptions(state.user.id);
    if (res.success && Array.isArray(res.data)) {
      state.subscriptions = res.data;
      renderSubscriptions();
      renderMetrics();
    }
  } catch (err) {
    showToast("Failed to fetch subscriptions: " + err.message, true);
  }
}

// Modal Handlers
function openCreateModal() {
  dom.subModalTitle.textContent = "NEW SUBSCRIPTION";
  dom.subIdInput.value = "";
  dom.subForm.reset();
  document.getElementById("subStart").value = new Date().toISOString().split("T")[0];
  dom.subModal.classList.add("open");
}

function openEditModal(sub) {
  dom.subModalTitle.textContent = "EDIT SUBSCRIPTION";
  dom.subIdInput.value = sub.id;
  document.getElementById("subName").value = sub.name;
  document.getElementById("subPrice").value = sub.price;
  document.getElementById("subCurrency").value = sub.currency || "USD";
  document.getElementById("subFreq").value = sub.frequency || "monthly";
  document.getElementById("subCat").value = sub.category || "entertainment";
  document.getElementById("subPayment").value = sub.paymentMethod || "Credit Card";
  document.getElementById("subStart").value = sub.startDate || "";
  document.getElementById("subRenewal").value = sub.renewalDate || "";
  dom.subModal.classList.add("open");
}

function closeSubModal() {
  dom.subModal.classList.remove("open");
}

async function handleSubFormSubmit(e) {
  e.preventDefault();
  const id = dom.subIdInput.value;
  const data = {
    name: document.getElementById("subName").value.trim(),
    price: parseFloat(document.getElementById("subPrice").value),
    currency: document.getElementById("subCurrency").value,
    frequency: document.getElementById("subFreq").value,
    category: document.getElementById("subCat").value,
    paymentMethod: document.getElementById("subPayment").value.trim(),
    startDate: document.getElementById("subStart").value,
    renewalDate: document.getElementById("subRenewal").value || null,
  };

  try {
    if (id) {
      await api.updateSubscription(id, data);
      showToast("Subscription updated successfully!");
    } else {
      await api.createSubscription(data);
      showToast("Subscription added to Atlas!");
    }
    closeSubModal();
    await fetchSubscriptions();
  } catch (err) {
    showToast("Error saving subscription: " + err.message, true);
  }
}

async function handleCancelSubscription(id) {
  if (!confirm("Are you sure you want to cancel this subscription?")) return;
  try {
    await api.cancelSubscription(id);
    showToast("Subscription cancelled.");
    await fetchSubscriptions();
  } catch (err) {
    showToast("Failed to cancel: " + err.message, true);
  }
}

async function handleDeleteSubscription(id) {
  if (!confirm("Are you sure you want to permanently delete this subscription?")) return;
  try {
    await api.deleteSubscription(id);
    showToast("Subscription deleted.");
    await fetchSubscriptions();
  } catch (err) {
    showToast("Failed to delete: " + err.message, true);
  }
}

// Auth Handlers
function updateAuthUI() {
  if (state.user) {
    dom.userMeta.textContent = `USER: ${state.user.name.toUpperCase()}`;
    dom.authBtn.textContent = "SIGN OUT";
    dom.authBtn.className = "btn btn-ghost btn-sm";
  } else {
    dom.userMeta.textContent = "GUEST MODE";
    dom.authBtn.textContent = "SIGN IN";
    dom.authBtn.className = "btn btn-rust btn-sm";
  }
}

function openAuthModal() {
  if (state.user) {
    state.clearAuth();
    updateAuthUI();
    renderSubscriptions();
    renderMetrics();
    showToast("Signed out.");
    return;
  }
  isRegisterMode = false;
  renderAuthModal();
  dom.authModal.classList.add("open");
}

function renderAuthModal() {
  dom.authModeTitle.textContent = isRegisterMode ? "CREATE ACCOUNT" : "SIGN IN";
  dom.authSubmitBtn.textContent = isRegisterMode ? "REGISTER" : "SIGN IN";
  dom.nameGroup.style.display = isRegisterMode ? "block" : "none";
  dom.authTogglePrompt.innerHTML = isRegisterMode
    ? `Already registered? <a href="#" id="toggleAuthMode" class="rust">Sign in here</a>`
    : `New user? <a href="#" id="toggleAuthMode" class="rust">Create an account</a>`;

  document.getElementById("toggleAuthMode").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    renderAuthModal();
  });
}

function closeAuthModal() {
  dom.authModal.classList.remove("open");
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  try {
    let res;
    if (isRegisterMode) {
      const name = document.getElementById("authName").value.trim();
      res = await api.signUp({ name, email, password });
      showToast("Account created successfully!");
    } else {
      res = await api.signIn({ email, password });
      showToast("Welcome back, " + (res.data?.user?.name || "User"));
    }

    if (res.data?.token && res.data?.user) {
      state.setAuth(res.data.user, res.data.token);
      updateAuthUI();
      closeAuthModal();
      await fetchSubscriptions();
    }
  } catch (err) {
    showToast("Authentication failed: " + err.message, true);
  }
}

// Initial Bootstrapping
async function bootstrap() {
  state.init();
  renderPresets();

  // Check Backend
  const connected = await api.checkHealth();
  state.isBackendConnected = connected;
  const dot = dom.backendStatus.querySelector(".status-dot");
  const text = dom.backendStatus.querySelector(".status-text");

  if (connected) {
    dot.classList.remove("offline");
    text.textContent = "BACKEND: ONLINE (PORT 5500)";
  } else {
    dot.classList.add("offline");
    text.textContent = "BACKEND: OFFLINE";
    showToast("Spring Boot backend offline on port 5500", true);
  }

  // Pre-seed demo user if no user is saved yet for immediate testing
  if (!state.user) {
    try {
      const loginRes = await api.signIn({ email: "demo@billpilot.com", password: "BillPilot2026!" });
      if (loginRes.data?.token && loginRes.data?.user) {
        state.setAuth(loginRes.data.user, loginRes.data.token);
      }
    } catch {
      // Continue in guest mode if demo user doesn't exist
    }
  }

  updateAuthUI();
  await fetchSubscriptions();

  // Event Listeners
  dom.authBtn.addEventListener("click", openAuthModal);
  dom.newSubBtn.addEventListener("click", openCreateModal);
  document.getElementById("closeSubModal").addEventListener("click", closeSubModal);
  document.getElementById("cancelSubForm").addEventListener("click", closeSubModal);
  document.getElementById("closeAuthModal").addEventListener("click", closeAuthModal);
  dom.subForm.addEventListener("submit", handleSubFormSubmit);
  dom.authForm.addEventListener("submit", handleAuthSubmit);

  // Filter Pills
  dom.filterPills.forEach(pill => {
    pill.addEventListener("click", () => {
      dom.filterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.activeFilter = pill.dataset.filter;
      renderSubscriptions();
    });
  });

  // Search & Sort
  dom.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderSubscriptions();
  });

  dom.sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderSubscriptions();
  });
}

// Start app on DOM ready
document.addEventListener("DOMContentLoaded", bootstrap);
