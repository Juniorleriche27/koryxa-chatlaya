// next.config.ts
import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const isProd = process.env.NODE_ENV === "production";

// Optionnel : proxy API (via /api/*) si un reverse proxy local est utilisé
// (ex: /api/projects -> http://localhost:8000/projects)
const DEFAULT_API_BASE = "https://api.innovaplus.africa";
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE).replace(/\/+$/, "");
const INNOVA_API_BASE = (() => {
  let base = API_BASE.replace(/(\/innova\/api)+$/, "/innova/api");
  if (!base.endsWith("/innova/api")) {
    base = `${base}/innova/api`;
  }
  return base;
})();

type NextConfigWithTurbopack = NextConfig & {
  turbopack?: {
    rules: Record<string, { loaders: Array<string | { loader: string; options?: Record<string, unknown> }>; as: string }>;
  };
};

const nextConfig: NextConfigWithTurbopack = {
  reactStrictMode: true,
  poweredByHeader: false,

  typescript: { ignoreBuildErrors: false },

  typedRoutes: false,

  experimental: {
    optimizePackageImports: ["react", "react-dom"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${API_BASE}/auth/:path*` },
      { source: "/api/chatlaya/:path*", destination: `${API_BASE}/chatlaya/:path*` },
      {
        source: "/innova/api/:path*",
        destination: `${INNOVA_API_BASE}/:path*`,
      },
      {
        source: "/innova/api/innova/api/:path*",
        destination: `${INNOVA_API_BASE}/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [require.resolve("remark-gfm")],
  },
});

// Turbopack needs an explicit rule to handle MDX imports.
nextConfig.turbopack = {
  rules: {
    "*.mdx": {
      loaders: [
        {
          loader: "@next/mdx/mdx-js-loader.js",
          options: {
            remarkPlugins: ["remark-gfm"],
          },
        },
      ],
      as: "*.js",
    },
  },
};

export default withMDX(nextConfig);
