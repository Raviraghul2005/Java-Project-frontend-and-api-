"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function AuthPage() {
  const router = useRouter();
  const { login, register, isBackendConnected } = useApp();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let success = false;
    if (mode === "login") {
      success = await login(email, password);
    } else {
      success = await register(name || "Pilot User", email, password);
    }

    setLoading(false);
    if (success) {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
          <div className="size-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-sm">
            BP
          </div>
          <span className="font-semibold text-base text-zinc-100">
            Bill Pilot
          </span>
        </Link>
        <p className="text-xs text-zinc-400">
          Subscription Intelligence Platform
        </p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-xl">
        {/* Mode Tabs */}
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800/80 mb-5">
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => setMode("login")}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "login"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === "register"}
            onClick={() => setMode("register")}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "register"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Create account
          </button>
        </div>

        {/* Backend Status indicator */}
        <div className="mb-4 flex items-center justify-between text-xs py-1.5 px-2.5 rounded-md bg-zinc-950/60 border border-zinc-800/60">
          <span className="text-zinc-400 text-[11px]">Bill Pilot API</span>
          <span
            className={`text-[11px] font-medium flex items-center gap-1.5 ${
              isBackendConnected ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isBackendConnected ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            {isBackendConnected ? "Connected" : "Unreachable"}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-zinc-300 mb-1">
                Full name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300 mb-1">
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-300 mb-1">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 6 : undefined}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Authenticating..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
