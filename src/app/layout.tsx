import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { getCompanyProfile } from "@/lib/settings/company-profile";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const profile = await getCompanyProfile();
    const displayName = profile.displayName || "KN Finance Company";
    const iconUrl = profile.faviconUrl || "/favicon.ico";

    return {
      title: { default: displayName, template: `%s | ${displayName}` },
      description: profile.metaDescription || "KN Finance Company — Empowering your future. Multi-branch credit and loan management platform.",
      icons: {
        icon: iconUrl,
        shortcut: iconUrl,
      },
    };
  } catch {
    return {
      title: { default: "KN Finance Company", template: "%s | KN Finance Company" },
      description: "KN Finance Company — Empowering your future. Multi-branch credit and loan management platform.",
      icons: {
        icon: "/favicon.ico",
        shortcut: "/favicon.ico",
      },
    };
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
