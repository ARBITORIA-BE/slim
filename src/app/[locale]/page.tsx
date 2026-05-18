import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * 루트 레이아웃의 title template(`%s · Slim`) 을 사용하지 않고
 * default 값을 직접 쓰기 위해 absolute 로 설정한다.
 * 홈은 브랜드 슬로건 전체가 title 이어야 탭에서 의미가 있다.
 *
 * i18n: getTranslations (RSC) — 'home' 네임스페이스.
 * metadata 는 아직 정적 (4.5.j.4.B 에서 i18n 처리 예정).
 */
export const metadata: Metadata = {
  title: {
    // @i18n-allow metadata 한글은 4.5.j.4.B 대상 (layout metadata i18n)
    absolute: 'Slim — 비교는 쉽게, 절약은 두툼하게',
  },
  description:
    // @i18n-allow metadata 한글은 4.5.j.4.B 대상
    '벨기에 · 네덜란드 · 룩셈부르크에서 5분 안에 통신 요금을 비교하고 매달 더 영리한 선택을 하세요.',
  alternates: {
    canonical: '/',
  },
};

export default async function Home() {
  // why: RSC 이므로 getTranslations 사용 (await 필요).
  // 'home' 네임스페이스 = ko.json "home" 키 블록.
  const t = await getTranslations('home');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl font-medium tracking-tight">
        {t('headline')}<span className="text-accent">.</span>
      </h1>
      <p className="text-fg-soft text-lg max-w-md text-center">
        {t('tagline')}
      </p>
      <Link
        href="/compare"
        className="rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
      >
        {t('ctaButton')}
      </Link>
    </main>
  );
}
