import type { NextConfig } from "next";

// A static export (admin/out) served by the admin Worker's static assets (server/wrangler.admin.jsonc); the API is the
// same-origin /admin/api/* of that Worker. No server-side rendering and no Next.js server in production.
const config: NextConfig = { reactStrictMode: true, output: "export" };
export default config;
