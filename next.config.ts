import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "xlsx"],
  // pdfjs-dist (vía pdf-parse y renderPdfPageToPng) resuelve su "fake
  // worker" con un import() en tiempo de ejecución a una ruta que arma
  // como string -- el output file tracing de Vercel no sigue esa ruta,
  // así que pdf.worker.mjs no queda en el bundle desplegado ("Setting up
  // fake worker failed: Cannot find module '.../pdf.worker.mjs'"). El
  // fix real es src/lib/pdfjs-node-worker.ts (importa el worker con una
  // ruta literal, que sí se traza); esto es un refuerzo explícito por si
  // el tracer igual no lo detecta en alguna ruta.
  outputFileTracingIncludes: {
    "/api/cutmeat-reports/[companyId]/[reportDate]/package/pdf": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
    "/api/cutmeat-reports/[companyId]/[reportDate]/package/cover": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
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

export default withSerwist(nextConfig);
