import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sadboi/core"],
  poweredByHeader: false,
  distDir: process.env.SADBOI_AUTH_TEST === "1" ? ".next-auth-test" : ".next",
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default nextConfig;
