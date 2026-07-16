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
        <GlobalErrorBoundary>
          <QueryProvider>
            {children}
          </QueryProvider>
        </GlobalErrorBoundary>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}