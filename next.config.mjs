/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  cleanDistDir: !process.env.NEXT_BUILD_DIR,
  poweredByHeader: false,
  serverExternalPackages: ["pdf2json"],
  outputFileTracingIncludes: { "/api/upload": ["./workers/pdf.cjs", "./node_modules/pdf2json/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};

export default nextConfig;
