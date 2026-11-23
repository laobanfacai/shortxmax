import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "video.provideoshort.com" },
      { protocol: "https", hostname: "cdn.provideoshort.com" },
      { protocol: "https", hostname: "videohk2026.oss-cn-hongkong.aliyuncs.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "r2.open-traffic.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
