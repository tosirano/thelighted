import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { QueryProvider } from "@/providers/QueryProvider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Lighted",
  description: "The Lighted platform",
};

/**
 * RootLayout
 *
 * Structure:
 *  1. Static navigation shell (server-rendered, visible immediately)
 *  2. GlobalErrorBoundary catches render-phase errors
 *  3. QueryProvider hydrates client-side — does NOT block the static shell
 *
 * Heavy dashboard components (PopularItemsChart, RecentActivity) are
 * lazy-loaded via dynamic() with <Suspense> inside their page components,
 * so they never delay the initial shell render.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*
          Static navigation shell — rendered server-side.
          Visible before any client JS hydrates.
        */}
        <nav
          className="h-14 border-b bg-white flex items-center px-6 shrink-0"
          aria-label="Main navigation"
        >
          <span className="font-semibold text-gray-900">The Lighted</span>
        </nav>

        {/*
          GlobalErrorBoundary wraps the dynamic content only.
          The nav above stays visible even if an error boundary triggers.
        */}
        <GlobalErrorBoundary>
          {/*
            QueryProvider hydrates after the static shell is painted.
            Children can use <Suspense> boundaries independently.
          */}
          <QueryProvider>
            <main className="flex-1">{children}</main>
          </QueryProvider>
        </GlobalErrorBoundary>

        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}