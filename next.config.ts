import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// ADR-0033 §T1: next-intl plugin 배선.
// request.ts 경로 명시 — next-intl이 getRequestConfig를 찾는 기준점.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ADR-0051 §D1: MDX RSC native 통합 — @next/mdx.
// pageExtensions 에 'mdx' 추가 → src/content/guides/*.mdx 를 RSC import 가능.
// remark/rehype 플러그인 0 (P1 범위 — 추가 필요 시 별 ADR).
const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

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
  // ADR-0051 §D1: MDX 파일 확장자 등록 — 빌드 시 .mdx 파일을 RSC로 처리.
  pageExtensions: ['tsx', 'ts', 'mdx'],
};

// PLAN 4.5.2.a: Sentry 래핑. SENTRY_AUTH_TOKEN 부재 시 source map upload 자동 skip
// (운영자 트랙 — DSN 발급 + env 등록 후 source map 활성).
// tunnelRoute = client → server proxy (광고 차단기 회피 + US Sentry 직접 노출 가드,
// ADR-0037 §6.1 처리방침 §3국 이전).
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default withSentryConfig(withNextIntl(withMDX(config)), {
  ...(sentryOrg ? { org: sentryOrg } : {}),
  ...(sentryProject ? { project: sentryProject } : {}),
  ...(sentryAuthToken ? { authToken: sentryAuthToken } : {}),
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring/sentry-tunnel',
  hideSourceMaps: true,
  disableLogger: true,
});
