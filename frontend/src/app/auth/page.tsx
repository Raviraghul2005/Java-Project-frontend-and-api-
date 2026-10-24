"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark, ShieldIcon, SparklesIcon, TrendingUpIcon } from "@/components/ui/icons";
import { RingGauge } from "@/components/ui/RingGauge";
import { Segmented } from "@/components/ui/Segmented";
import { Sparkline } from "@/components/ui/Sparkline";
import { SubLogo } from "@/components/ui/SubLogo";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/cn";

/** Decorative preview of the product for the sign-in page. Static sample data, hidden from assistive tech. */
function HeroPreview() {
  const rows = [
    { name: "Figma", price: "$15.00", due: "Due tomorrow", tone: "bg-rose-500/12 text-rose-300 ring-rose-400/20" },
    { name: "Netflix", price: "$15.49", due: "Due in 2 days", tone: "bg-rose-500/12 text-rose-300 ring-rose-400/20" },
    { name: "Spotify", price: "$11.99", due: "Due in 5 days", tone: "bg-amber-400/12 text-amber-300 ring-amber-300/20" }
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto mt-12 h-[21rem] w-full max-w-lg select-none">
      <div className="glass animate-float absolute left-0 top-0 w-72 rounded-3xl p-4" style={{ animationDelay: "0s" }}>
        <p className="mb-2.5 text-xs font-bold text-zinc-200">Quick Action</p>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2">
              <SubLogo name={row.name} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-zinc-100">{row.name}</span>
                <span className="block text-[11px] text-zinc-500">{row.price} · monthly</span>
              </span>
              <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset", row.tone)}>{row.due}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="glass animate-float absolute bottom-2 right-0 w-60 rounded-3xl p-4" style={{ animationDelay: "-3s" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-200">Next 12 months</p>
          <TrendingUpIcon className="size-4 text-brand-300" />
        </div>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-50">$2,987.27</p>
        <Sparkline values={[210, 230, 250, 340, 260, 250, 310, 255, 250, 260, 345, 252]} className="mt-2 h-14 w-full" />
      </div>

      <div className="glass animate-float absolute right-8 top-6 flex items-center gap-3 rounded-2xl p-3" style={{ animationDelay: "-5.5s" }}>
        <RingGauge value={42} color="#fbbf24" size={52} thickness={4}>
          <span className="text-[13px] font-extrabold text-zinc-50">42</span>
        </RingGauge>
        <span className="pr-1 leading-tight">
          <span className="block text-[11px] text-zinc-400">Fatigue index</span>
          <span className="block text-sm font-bold text-amber-300">Moderate</span>
        </span>
      </div>
    </div>
  );
}

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
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Brand side (large screens) */}
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
        <Link href="/" className="flex w-fit items-center gap-3">
          <LogoMark className="size-11" />
          <span className="flex flex-col leading-tight">
            <span className="text-gradient text-xl font-extrabold tracking-tight">Bill Pilot</span>
            <span className="text-xs text-zinc-500">Subscription Intelligence Platform</span>
          </span>
        </Link>

        <div className="animate-fade-up">
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tight xl:text-[3.6rem]">
            Every subscription.
            <br />
            <span className="text-gradient">One calm dashboard.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-400">
            Find the charges you forgot, see what is renewing next and cut the overlap, before the next bill lands.
          </p>
          <ul className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold text-zinc-300">
            {["Statement scanner", "Renewal alerts", "Fatigue audit"].map((feature) => (
              <li key={feature} className="flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3.5 py-1.5">
                <SparklesIcon className="size-3.5 text-brand-300" />
                {feature}
              </li>
            ))}
          </ul>
          <HeroPreview />
        </div>

        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <ShieldIcon className="size-4" />
          Statements are analysed in memory and never stored.
        </p>
      </section>

      {/* Form side */}
      <section className="flex flex-col items-center justify-center p-5 sm:p-8">
        <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <LogoMark className="size-10" />
          <span className="text-gradient text-xl font-extrabold tracking-tight">Bill Pilot</span>
        </Link>

        <div className="glow-border animate-scale-in w-full max-w-md rounded-3xl">
          <div className="glass rounded-3xl p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold tracking-tight text-zinc-50">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {mode === "login" ? "Sign in to see where your money goes." : "Start tracking every recurring charge."}
              </p>
            </div>

            {/* Mode Tabs */}
            <Segmented
              ariaLabel="Account mode"
              className="mb-5 w-full"
              value={mode}
              onChange={setMode}
              options={[
                { value: "login", label: "Sign in" },
                { value: "register", label: "Create account" }
              ]}
            />

            {/* Backend Status indicator */}
            <div className="mb-5 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-2.5">
              <span className="text-[11px] text-zinc-400">Bill Pilot API</span>
              <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold", isBackendConnected ? "text-emerald-300" : "text-rose-300")}>
                <span className={cn("size-1.5 rounded-full", isBackendConnected ? "bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]" : "bg-rose-400")} />
                {isBackendConnected ? "Connected" : "Unreachable"}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="animate-fade-up">
                  <label htmlFor="auth-name" className="mb-1.5 block text-xs font-semibold text-zinc-300">
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
                    className="field"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-xs font-semibold text-zinc-300">
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
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-xs font-semibold text-zinc-300">
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
                  className="field"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3 text-sm">
                {loading ? "Authenticating..." : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
