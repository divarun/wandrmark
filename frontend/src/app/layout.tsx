"use client";
import "@/styles/globals.css";
import { GamificationProvider } from "@/contexts/GamificationContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <title>Wandrmark — Smart Local Explorer</title>
        <meta name="description" content="Discover, explore, and plan your local adventures with AI-powered insights." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body
        className="min-h-screen text-white font-body"
        style={{ background: "var(--bg)" }}
        suppressHydrationWarning
      >
        {!mounted ? (
          <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse" style={{
                background: "linear-gradient(135deg, var(--cyan), oklch(0.65 0.12 235))",
                boxShadow: "0 0 20px oklch(0.55 0.12 205 / 0.5)",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.18 0.04 250)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s-7-7-7-13a7 7 0 1 1 14 0c0 6-7 13-7 13Z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: "var(--ink-3)" }}>Loading Wandrmark…</p>
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            <GamificationProvider>
              {children}
            </GamificationProvider>
          </ErrorBoundary>
        )}
        <Analytics />
      </body>
    </html>
  );
}
