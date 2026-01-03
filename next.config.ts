import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "upskirtcandy.com" }],
        destination: "https://www.upskirtcandy.com/:path*",
        permanent: true, // 308
      },
    ];
  },
  
    matcher: ['/((?!api|_next/static|_next/image|sitemap\\.xml|sitemap/|robots\\.txt|favicon\\.ico).*)'],

  htmlLimitedBots: /bot|crawler|spider|facebookexternalhit|Twitterbot|Slackbot|redditbot/i,
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/trim-video": ["./node_modules/ffmpeg-static/**"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dzgpkywovaezlaabuxhl.supabase.co", 
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
