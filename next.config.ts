import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

module.exports = {
  allowedDevOrigins: ['heterodoxly-unchastened-nichole.ngrok-free.dev'],
}

export default nextConfig;
