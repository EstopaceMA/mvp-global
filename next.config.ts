import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: { remotePatterns: [{ protocol: "https", hostname: "images.mvp.microsoft.com", pathname: "/**" }] },
  outputFileTracingIncludes: {
    "/mvps/*/preview": [
      "./public/mvp-logo.png",
      "./node_modules/@fontsource/geist/files/*-{400,700}-normal.woff",
      "./node_modules/@fontsource/noto-sans-{jp,kr,sc}/files/*-400-normal.woff",
    ],
  },
  async headers() {
    return [{ source: "/data/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};
export default nextConfig;
