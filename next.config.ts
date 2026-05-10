import type { NextConfig } from 'next';

// ADR-0002: 검증 권한은 로컬 stop-gate + GitHub Actions가 소유.
// Vercel은 순수 빌드 머신.
//
// typedRoutes 옵션 자체를 제거 (Next.js 15.5에서 experimental → top-level 이전됐고
// 페이즈 2 진입 시점 비활성 유지 결정 — 2026-05-10). 동적 라우트
// (`/compare/${category}/postal` 등) cast 부담이 학습자 모드에 부적합.
// 페이즈 4 베타 진입 시 라우트 안정 후 재활성화 검토.
const config: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default config;
