/**
 * /legal/affiliate-disclosure — 어필리에이트 수수료 공개 (헌법 §3 P3).
 *
 * 왜 이 페이지가 필요한가?
 *   헌법 §3 P3: "모든 제휴 수수료는 비교 결과 페이지 하단에 단가까지 공개."
 *   /r/[shortId] footer 와 /data-sources 본문에서 이 URL 을 참조한다.
 *   페이즈 6.9 에서 실 수수료 데이터 공개 예정 — 현재는 정직한 "준비 중" 안내.
 *
 * RSC — 정적 콘텐츠, 동적 데이터 없음. revalidate 불필요.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '제휴 수수료 공개',
  description:
    'Slim의 제휴(어필리에이트) 수수료 구조와 비교 결과 순위 알고리즘 독립성을 투명하게 공개합니다.',
  alternates: {
    canonical: '/legal/affiliate-disclosure',
  },
};

export default function AffiliatePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          제휴 수수료 공개
        </h1>
        <p className="text-sm text-fg-soft">
          헌법 §3 P3: &quot;투명성은 운영자의 짐. 데이터로 보여준다.&quot;
        </p>
      </header>

      <section className="flex flex-col gap-6 text-sm leading-relaxed text-fg-soft">
        <div className="rounded-2xl border border-fg/10 bg-bg-warm/60 p-5">
          <h2 className="mb-2 font-semibold text-fg">현재 상태</h2>
          <p>
            Slim은 현재 베타 준비 단계(페이즈 3)로, 어필리에이트 수수료 계약이
            활성화되지 않았습니다. 모든 비교 결과는 수수료와 무관하게 절약액
            기준 알고리즘으로 순위가 결정됩니다.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold text-fg">
            어필리에이트 수수료와 비교 순위
          </h2>
          <p>
            어필리에이트 계약이 체결되더라도 비교 결과 순위는 절약액 알고리즘에만
            근거합니다. 수수료 수취 여부는 순위에 영향을 주지 않습니다. 이는
            헌법 §8 #4 (&quot;광고 영역과 비교 영역을 섞지 않는다&quot;) 에 의해 보장됩니다.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold text-fg">
            향후 수수료 공개 계획
          </h2>
          <p>
            페이즈 6.9(베타 후 정식 런치)에서 공급사별 수수료 단가까지 이 페이지에
            공개할 예정입니다. 공개 항목: 공급사명, 수수료 유형(CPA/CPL), 단가,
            계약 시작일.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold text-fg">문의</h2>
          <p>
            어필리에이트 정책 관련 문의:{' '}
            <a
              href="mailto:kim.wonmin91@gmail.com"
              className="underline underline-offset-4 hover:text-fg"
            >
              kim.wonmin91@gmail.com
            </a>
          </p>
        </div>
      </section>

      <footer className="mt-10 border-t border-fg/10 pt-4 text-xs text-fg-soft">
        <Link
          href="/data-sources"
          className="underline-offset-4 hover:underline"
        >
          ← 데이터 출처로 돌아가기
        </Link>
      </footer>
    </main>
  );
}
