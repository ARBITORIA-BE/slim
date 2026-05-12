import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';

/**
 * 루트 레이아웃의 title template(`%s · Slim`) 을 사용하지 않고
 * default 값을 직접 쓰기 위해 absolute 로 설정한다.
 * 홈은 브랜드 슬로건 전체가 title 이어야 탭에서 의미가 있다.
 */
export const metadata: Metadata = {
  title: {
    absolute: 'Slim — 비교는 쉽게, 절약은 두툼하게',
  },
  description:
    '벨기에 · 네덜란드 · 룩셈부르크에서 5분 안에 통신 요금을 비교하고 매달 더 영리한 선택을 하세요.',
  alternates: {
    canonical: '/',
  },
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl font-medium tracking-tight">
        Slim<span className="text-accent">.</span>
      </h1>
      <p className="text-fg-soft text-lg max-w-md text-center">
        비교는 쉽게, 절약은 두툼하게.
      </p>
      <Button>지금 비교하기</Button>
      <p className="text-muted text-sm mt-8">Phase 0 부트스트랩 완료 ✅</p>
    </main>
  );
}
