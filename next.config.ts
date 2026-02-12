import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["172.19.128.13:3000", "localhost:3000"],
    },
  },
};

export default nextConfig;
