import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "**.shopify.com" },
      { protocol: "https", hostname: "**.factorydirectparty.com" },
      { protocol: "https", hostname: "**.orientaltrading.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
