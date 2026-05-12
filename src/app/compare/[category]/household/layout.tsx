/**
 * /compare/[category]/household — noindex layout.
 *
 * 왜 layout.tsx 를 따로 만드는가?
 *   page.tsx 가 `'use client'` 이기 때문에 `export const metadata` 를 직접 넣을 수 없다.
 *   Next.js App Router 규칙: 'use client' 컴포넌트에서는 metadata export 가 무시된다.
 *   → 부모 layout.tsx 에서 metadata 를 선언하면 이 규칙을 우회할 수 있다.
 *   layout 은 서버 컴포넌트이므로 metadata 선언이 정상 작동한다.
 *
 * 왜 noindex 인가?
 *   입력 폼 단계(가구 형태)는 sessionStorage 상태에 의존하고, 단독 URL 접근 시
 *   의미 있는 콘텐츠가 없다. PLAN 3.5.2.c 참조.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '가구 형태 선택',
  robots: { index: false, follow: false },
};

export default function HouseholdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
