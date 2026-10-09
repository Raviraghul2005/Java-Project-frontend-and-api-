"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";

export function Navbar({ onOpenNewModal }: { onOpenNewModal: () => void }) {
  const pathname = usePathname();
  const { user, isBackendConnected, logout } = useApp();

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/analytics", label: "Fatigue Audit" },
    { href: "/simulator", label: "Arbitrage Lab" },
    { href: "/catalog", label: "Catalog" },
    { href: "/settings", label: "Settings" }
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#09090b]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-sm tracking-tight shadow-sm transition-transform group-hover:scale-105">
              BP
            </div>
            <span className="font-semibold text-sm tracking-tight text-zinc-100 group-hover:text-white transition-colors">
              Bill Pilot
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100 font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Status, Add Action & Auth */}
        <div className="flex items-center gap-3">
          {/* Subtle Backend Status indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
            <span
              className={`size-1.5 rounded-full ${
                isBackendConnected ? "bg-emerald-400" : "bg-zinc-500"
              }`}
            />
            <span>{isBackendConnected ? "API 5500" : "Standalone"}</span>
          </div>

          <button
            onClick={onOpenNewModal}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <svg
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>New</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
              <span className="text-xs text-zinc-300 font-medium hidden sm:inline">
                {user.name}
              </span>
              <button
                onClick={logout}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-1 rounded hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2.5 py-1 rounded-md hover:bg-zinc-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
