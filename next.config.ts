import type { NextConfig } from "next";
import { join } from "path";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  // Prevent Next from inferring a parent workspace root due to extra lockfiles.
  outputFileTracingRoot: join(__dirname),
};

export default nextConfig;
