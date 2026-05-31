import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  // Lets the web app import `@accountly/backend`'s `.ts` source directly so
  // the Hono RPC `AppType` flows through without a build step.
  transpilePackages: ["@accountly/backend"],

  // Same-origin proxy: browser hits /api/* on the Next dev server, which
  // forwards to the Worker. Cookies + bearer keys work with zero CORS code.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
  turbopack: {},

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui.shadcn.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // Headers for better security and performance
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // SAMEORIGIN (not DENY) so the bill detail page can render the
            // invoice PDF in a same-origin <iframe src="/api/bills/:id/file">.
            // Still blocks external sites from framing the app (clickjacking).
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
