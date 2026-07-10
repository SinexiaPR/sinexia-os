import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/dashboard/documents",
        destination: "/dashboard/inbox",
        permanent: true,
      },
      {
        source: "/dashboard/help",
        destination: "/dashboard/ayuda",
        permanent: false,
      },
      {
        source: "/dashboard/companies",
        destination: "/dashboard/empresas",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
