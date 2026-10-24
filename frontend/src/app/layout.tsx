import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/shell/AppShell";
import { ToastContainer } from "@/components/ToastContainer";

export const metadata: Metadata = {
  title: "BILL PILOT // Autonomous Subscription Intelligence & Fatigue Audit",
  description:
    "Production-grade subscription auditing, functional redundancy matrix, and vampire drain prevention engine powered by Spring Boot 3.4 & Next.js."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen text-zinc-100 font-sans">
        <AppProvider>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
          <ToastContainer />
        </AppProvider>
      </body>
    </html>
  );
}
