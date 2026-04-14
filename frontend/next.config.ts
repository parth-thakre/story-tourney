import type { NextConfig } from "next";
import os from "node:os";

const hostname = os.hostname().trim();
const allowedDevOrigins = Array.from(
  new Set(
    [hostname, `*.${hostname}`, ...(process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "").split(",")]
      .map((value) => value.trim())
      .filter(Boolean),
  ),
);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  async rewrites() {
    const apiBase = process.env.API_PROXY_URL ?? "http://127.0.0.1:9966";
    return [
      {
        source: "/health",
        destination: `${apiBase}/health`,
      },
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
