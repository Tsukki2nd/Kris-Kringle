import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Snowfall from "@/components/Snowfall";
import "./globals.css";

export const metadata: Metadata = {
  title: "Secret Santa — Wheel of Names",
  description: "Christmas party Secret Santa / Kris Kringle wheel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-ink antialiased">
        <Snowfall />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
