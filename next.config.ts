import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  typescript: {
    ignoreBuildErrors: true
  }
  /* config options here */
};

export default nextConfig;
