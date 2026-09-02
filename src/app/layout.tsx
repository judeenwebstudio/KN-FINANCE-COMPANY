import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = { title: { default: "KN Finance Company", template: "%s | KN Finance Company" }, description: "KN Finance Company — Empowering your future. Multi-branch credit and loan management platform." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}><body className="antialiased">{children}</body></html>;
}
