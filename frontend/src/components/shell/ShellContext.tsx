"use client";

import { createContext, useContext } from "react";

interface ShellContextValue {
  /** Opens the "new subscription" dialog from anywhere in the app. */
  openCreate: () => void;
  /** Opens the command palette (also Ctrl/Cmd + K). */
  openPalette: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside <AppShell>");
  return value;
}
