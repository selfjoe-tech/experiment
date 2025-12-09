import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  async headers() {
    return [
      // Apply COOP/COEP to the watermark page
      {
        source: "/upload",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
      // And to Next static files (wasm / js chunks)
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
  /* config options here */

  experimental: {
    serverActions: {
      // pick what you’re comfortable with
      bodySizeLimit: "50mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dzgpkywovaezlaabuxhl.supabase.co", // e.g. dsfwhplhdvharctcnvcz.supabase.co
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "dzgpkywovaezlaabuxhl.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
