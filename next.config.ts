import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  async headers() {
    return [
      {
        source: "/reset-password",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
