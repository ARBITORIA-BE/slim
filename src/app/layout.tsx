/**
 * Root Layout — next-intl v3 App Router 패턴 (ADR-0033 §T1).
 *
 * next-intl [locale] layout 패턴에서 root layout 은 최소화.
 * <html> / <body> 태그는 [locale]/layout.tsx 가 담당.
 * 이 파일은 font/globals.css 같은 빌드 수준 설정만 포함.
 *
 * 왜 <html> 태그를 제거했는가?
 *   next-intl v3 App Router 표준: [locale]/layout.tsx 에서 <html lang={locale}>
 *   을 선언해야 locale별 언어 속성이 HTML에 반영됨. root layout 에도 <html> 이
 *   있으면 중첩되어 Next.js가 경고를 발생시키고 SEO가 깨짐.
 *
 * metadata 는 [locale]/layout.tsx 로 이동됨.
 */

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
