import type { NextConfig } from "next";

function apiOrigin(): string | undefined {
  const url = process.env.API_URL?.trim().replace(/\/$/, "");
  return url || undefined;
}

const nextConfig: NextConfig = {
  async rewrites() {
    const origin = apiOrigin();

    if (!origin) {
      return [];
    }

    // Browser calls /api/* on this app. The path after /api is forwarded
    // to the Render API, so service URLs stay in the server environment.
    return [
      {
        source: "/api/:path*",
        destination: `${origin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
