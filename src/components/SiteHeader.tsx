/**
 * SiteHeader — 전 페이지 상단 sticky 헤더 (ADR-0041 Amendment 3 D14~D18, PLAN 4.13.c).
 *
 * RSC. LocaleSwitcher above-the-fold 배치 — 베네룩스 다국어 시장 진입 차단 해소.
 * - 좌측: "Slim" 브랜드 텍스트 링크 (font-display, ADR-0035 LEGAL_ENTITY 정합)
 * - 우측: <LocaleSwitcher /> (client island, ADR-0036 D3)
 *
 * 왜 RSC인가:
 *   브랜드 링크 + 컨테이너는 서버에서 렌더 가능. LocaleSwitcher 만 client island.
 *   footer (RSC) 와 동일 패턴 (SiteFooter + LocaleSwitcher 분리).
 *
 * height: py-3 + text-lg ≈ 56px (ADR-0041 D17 — 모바일 56px 이내).
 * backdrop-blur: scroll 시 콘텐츠 가독성 보존.
 */

import Link from 'next/link';

import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export function SiteHeader() {
  return (
    // ADR-0041 D14: sticky top-0 z-40 + border-b + backdrop-blur
    <header className="sticky top-0 z-40 w-full border-b border-fg/10 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
        {/* 브랜드 로고 — 텍스트 (Q11 옵션 A 디폴트; SVG 교체는 별 PR) */}
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-fg hover:text-primary transition-colors"
        >
          Slim
        </Link>
        {/* LocaleSwitcher: client island (usePathname/useLocale 필요) */}
        <LocaleSwitcher />
      </div>
    </header>
  );
}
