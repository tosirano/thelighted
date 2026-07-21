import type { NextConfig } from "next";

/**
 * Content-Security-Policy header.
 *
 * Policy rationale:
 *  - default-src 'self'         — only same-origin resources by default
 *  - script-src 'self'          — no inline scripts; no eval
 *  - style-src 'self' 'unsafe-inline' — Tailwind injects inline styles at runtime
 *  - img-src 'self' data: blob: https: — allow remote images and data URIs for avatars
 *  - font-src 'self' https://fonts.gstatic.com — Google Fonts
 *  - connect-src 'self' https:  — API calls to same origin + any HTTPS endpoint
 *  - frame-ancestors 'none'     — block clickjacking
 *  - object-src 'none'          — block Flash / plugins
 *  - base-uri 'self'            — prevent base tag injection
 *  - form-action 'self'         — prevent form hijacking
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: CSP,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;