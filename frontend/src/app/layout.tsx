import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { AuthGuard } from "@/components/AuthGuard";
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
      <body suppressHydrationWarning className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-zinc-100 selection:text-zinc-950">
        <AppProvider>
          <AuthGuard>
            <div className="flex-1 flex flex-col min-h-screen">
              {children}
            </div>
          </AuthGuard>
          <ToastContainer />
        </AppProvider>
      </body>
    </html>
  );
}
