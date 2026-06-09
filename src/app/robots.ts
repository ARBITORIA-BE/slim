// app/robots.ts -- Next.js App Router 네이티브 robots.txt.
//
// 왜 이 파일이 필요한가?
//   robots.txt 는 검색엔진 크롤러가 가장 먼저 확인하는 파일이다.
//   Next.js 15 App Router 는 app/robots.ts 를 빌드 시 /robots.txt 로 정적 생성한다.
//   (next build 출력에 ○ /robots.txt 또는 ƒ /robots.txt 로 등장 -- PLAN 3.5.2.d DoD)
//
// 왜 app/robots.ts vs 정적 public/robots.txt 인가?
//   정적 파일은 SITE_ORIGIN 상수를 사용할 수 없다 (런타임 없음).
//   app/robots.ts 는 TypeScript 로 sitemap URL 을 동적으로 구성할 수 있고,
//   Next.js 가 빌드 시 MetadataRoute.Robots 를 robots.txt 포맷으로 직렬화한다.
//
// Disallow 패턴 해설 (robots.txt 에 그대로 출력됨):
//   /r/                          -- 개인 비교 결과 (ADR-0021 §T8 noindex)
//   /compare/[cat]/current-provider -- 현재 공급사 선택 단계 (입력 폼, noindex, 3단계 진입점)
//   /compare/[cat]/household     -- 가구 형태 선택 단계 (입력 폼, noindex)
//   /compare/[cat]/preview       -- 비교 결과 로딩 중 단계 (redirect 즉시 발생, noindex)
//   /api/                        -- Next.js API route (HTML 아님, 크롤링 대상 아님)
//
// ADR-0043 §D5 (2026-06-08): postal 단계 제거 → /compare/*/postal Disallow 룰 삭제.
// ADR-0016 Amendment 3: bill 단계 제거 → /compare/*/bill Disallow 룰 삭제.
//
// 실제 robots.txt 출력 예:
//   Disallow: /compare/*/current-provider   <-- * 는 robots.txt 표준 와일드카드 (Google 2008년부터 지원)
//
// sitemap 필드 -- Google 등이 sitemap 위치를 자동 탐지하는 표준 힌트.
// "Sitemap: https://slim.lu/sitemap.xml" 라인으로 출력됨.
//
// ADR 근거: ADR-0020 §결정 7, ADR-0021 §T8, PLAN 3.5.2.d.

import type { MetadataRoute } from 'next';

import { SITE_ORIGIN } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // 개인 비교 결과 -- ADR-0021 §T8 noindex + 개인정보 보호
        '/r/',
        // 입력 폼 단계 -- sessionStorage 상태 의존, 색인 가치 없음 (PLAN 3.5.2.c).
        // ADR-0043 §D5: postal 라우트 부재 → 룰 제거. ADR-0016 Amd 3: bill 라우트 부재 → 룰 제거.
        // * 는 robots.txt 와일드카드: /compare/mobile/current-provider 등 모두 차단.
        '/compare/*/current-provider',
        '/compare/*/household',
        '/compare/*/preview',
        // API route -- HTML 아님, 크롤링 대상 아님
        '/api/',
      ],
    },
    // sitemap 필드 -> "Sitemap: https://slim.lu/sitemap.xml" 라인 생성.
    // 크롤러가 sitemap URL 을 명시적으로 알 수 있어 색인 효율이 높아진다.
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
