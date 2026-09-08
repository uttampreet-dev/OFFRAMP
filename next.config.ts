import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // data files and document templates are read from disk at runtime; keep them in the server bundle
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json", "./data/**/*.csv", "./data/**/*.txt", "./src/templates/**"],
  },
};

export default nextConfig;
