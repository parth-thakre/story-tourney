import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiBase = process.env.API_PROXY_URL ?? "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;