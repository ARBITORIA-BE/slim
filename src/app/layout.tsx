import type { Metadata } from 'next';
import './globals.css';

import { SITE_ORIGIN } from '@/lib/site';

/**
 * 루트 레이아웃 메타데이터 — 자식 page 의 metadata 가 없으면 이 값이 fallback.
 *
 * 왜 metadataBase 가 필요한가?
 *   Next.js 의 metadata.alternates.canonical / og:url 은 상대 경로를 받는다.
 *   metadataBase 가 없으면 절대 URL 로 변환되지 않아 검색엔진이 canonical 을 무시한다.
 *   → `new URL(SITE_ORIGIN)` 으로 상대 경로 → 절대 URL 자동 변환.
 *
 * 왜 title template 인가?
 *   `template: '%s · Slim'` 으로 자식 page 의 title 이 자동으로 "페이지명 · Slim" 이 됨.
 *   탭 제목이 모든 페이지에서 고유해지고, 브랜드 일관성이 유지된다.
 *   자식 page 에서는 ` · Slim` 없이 페이지 고유 이름만 적으면 된다.
 *
 * og:image 는 의도적으로 미설정 — ADR-0021 §T8 SC-G (페이즈 4 ADR-OG 에서 동적 OG 일괄).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: 'Slim — 비교는 쉽게, 절약은 두툼하게',
    template: '%s · Slim',
  },
  description: '베네룩스 비교 플랫폼. BE · NL · LU에서 5분 안에 비교.',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Slim',
    title: 'Slim — 비교는 쉽게, 절약은 두툼하게',
    description: '베네룩스 비교 플랫폼. BE · NL · LU에서 5분 안에 비교.',
    // og:image 미설정 — ADR-0021 §T8 SC-G (페이즈 4 이연)
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Slim — 비교는 쉽게, 절약은 두툼하게',
    description: '베네룩스 비교 플랫폼. BE · NL · LU에서 5분 안에 비교.',
    // twitter:image 미설정 — 페이즈 4 ADR-OG 와 함께 일괄 추가
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
