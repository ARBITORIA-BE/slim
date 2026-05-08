import type { NextConfig } from 'next';

// ADR-0002: 검증 권한은 로컬 stop-gate + GitHub Actions가 소유.
// Vercel은 순수 빌드 머신.
const config: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default config;
