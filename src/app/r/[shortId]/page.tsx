/**
 * /r/[shortId] — 영구 비교 결과 링크 (ADR-0007 §T7 + ADR-0016 §T7).
 *
 * 페이즈 2 1차: placeholder. 결과 페이지 풀버전(3.1~3.7 결과 카드 / 비교 표 /
 * 계산 근거 / 제외 공급사 / 영구 보존)은 페이즈 3 (M6) 진입 시 별도 ADR로 도입.
 *
 * P3 정직성 (ADR-0011 §T2 항목 5 동형) — 미구현을 명시하고 *언제* 구현하는지
 * 사용자에게 노출.
 */

import Link from 'next/link';

export default async function ResultPlaceholderPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted">결과 링크</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          비교 결과 페이지는 곧 추가됩니다
        </h1>
      </header>

      <section className="rounded-2xl border border-fg/10 bg-bg-warm/40 p-6 text-sm leading-relaxed text-fg-soft">
        <p>
          현재 페이즈 2 입력 플로우 검증 단계입니다. 결과 카드 / 비교 표 / 계산
          근거 / 제외 공급사 섹션 / 영구 보관 등 풀버전은{' '}
          <strong className="text-fg">페이즈 3 (M6 진입 시점)</strong>에 추가 예정입니다.
        </p>
        <p className="mt-3">
          이 링크는 영구 보존되므로 페이즈 3 진입 후 다시 방문하시면 결과를 보실 수 있습니다.
        </p>
        <p className="mt-3 text-xs">
          영구 ID: <code className="rounded bg-bg px-1.5 py-0.5 font-mono">{shortId}</code>
        </p>
      </section>

      <Link
        href="/"
        className="inline-flex items-center justify-center self-start rounded-full bg-fg px-6 py-3 text-sm font-medium text-bg transition hover:bg-primary"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
