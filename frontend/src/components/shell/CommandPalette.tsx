"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/cn";
import { useDialog } from "@/lib/useDialog";
import { CornerDownLeftIcon, PlusIcon, ScanIcon, SearchIcon } from "@/components/ui/icons";
import { SubLogo } from "@/components/ui/SubLogo";
import { NAV_ITEMS } from "./nav";

interface Command {
  id: string;
  group: "Actions" | "Go to" | "Subscriptions";
  title: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
  onCreate: () => void;
}

/** Ctrl/Cmd+K launcher: jump to a page, start an action, or find one of your subscriptions. Keyboard first. */
export function CommandPalette({ onClose, onCreate }: CommandPaletteProps) {
  const router = useRouter();
  const { subscriptions, setSearchQuery, setActiveFilter } = useApp();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const all: Command[] = [
      { id: "new", group: "Actions", title: "New subscription", hint: "Track a service by hand", icon: <PlusIcon className="size-4" />, run: () => { onClose(); onCreate(); } },
      { id: "scan", group: "Actions", title: "Scan a bank statement", hint: "Find hidden recurring charges", icon: <ScanIcon className="size-4" />, run: go("/scan") },
      ...NAV_ITEMS.map((item): Command => {
        const Icon = item.icon;
        return { id: `nav-${item.href}`, group: "Go to", title: item.label, icon: <Icon className="size-4" />, run: go(item.href) };
      }),
      ...subscriptions.map((sub): Command => ({
        id: `sub-${sub.id}`,
        group: "Subscriptions",
        title: sub.name,
        hint: `${sub.category} · ${sub.status}`,
        icon: <SubLogo name={sub.name} className="size-7 rounded-lg" />,
        run: () => {
          onClose();
          setActiveFilter("all");
          setSearchQuery(sub.name);
          router.push("/");
        }
      }))
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all.filter((c) => c.group !== "Subscriptions");
    return all.filter((c) => c.title.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q)).slice(0, 12);
  }, [query, subscriptions, router, onClose, onCreate, setActiveFilter, setSearchQuery]);

  const index = commands.length === 0 ? 0 : Math.min(cursor, commands.length - 1);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((index + 1) % Math.max(commands.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((index - 1 + commands.length) % Math.max(commands.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[index]?.run();
    }
  };

  let lastGroup = "";
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[14vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="glass animate-scale-in w-full max-w-xl overflow-hidden rounded-3xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4">
          <SearchIcon className="size-[18px] shrink-0 text-brand-300" />
          <input
            data-autofocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Search pages, actions and subscriptions…"
            aria-label="Search commands"
            className="w-full bg-transparent text-[15px] text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">Esc</kbd>
        </div>

        <ul ref={listRef} role="listbox" aria-label="Results" className="max-h-[22rem] overflow-y-auto p-2">
          {commands.length === 0 && <li className="px-4 py-10 text-center text-sm text-zinc-500">Nothing matches &ldquo;{query}&rdquo;</li>}
          {commands.map((command, i) => {
            const header = command.group !== lastGroup;
            lastGroup = command.group;
            return (
              <React.Fragment key={command.id}>
                {header && <li role="presentation" className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-zinc-500 first:pt-1">{command.group}</li>}
                <li role="option" aria-selected={i === index} data-index={i}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={command.run}
                    onPointerMove={() => i !== index && setCursor(i)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150",
                      i === index ? "bg-brand-500/18 text-white" : "text-zinc-300"
                    )}
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", i === index ? "bg-brand-500/30 text-brand-100" : "bg-white/[0.06] text-zinc-400")}>{command.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{command.title}</span>
                      {command.hint && <span className="block truncate text-[11px] capitalize text-zinc-500">{command.hint}</span>}
                    </span>
                    {i === index && <CornerDownLeftIcon className="size-4 shrink-0 text-brand-200" />}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-white/[0.07] px-5 py-2.5 text-[11px] text-zinc-500">
          <span><kbd className="font-semibold text-zinc-300">↑↓</kbd> to move</span>
          <span><kbd className="font-semibold text-zinc-300">↵</kbd> to open</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
