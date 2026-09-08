import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — outputs plain HTML/JS/CSS to /out, perfect for GitHub Pages.
  output: "export",
  // GitHub Pages serves the repo at https://<user>.github.io/<repo>/
  // so we need to prefix asset paths with the repo name.
  // Change this if your repo is named differently.
  // (You can override with the NEXT_PUBLIC_BASE_PATH env var.)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  images: {
    // next/image optimization requires a server — disable for static export.
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
