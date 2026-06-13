/**
 * SortTabs — 정렬 탭 4종 + "Why this order?" 펼침 (ADR-0050 §D3).
 *
 * 설계:
 *   - dep 0 (Next Link + HTML <details> 만 — 헌법 §5 신규 의존성 금지).
 *   - RSC — getTranslations 사용.
 *   - 탭 4종: cheapest / most_saved / best_value / most_reliable.
 *   - "Why this order?" = <details><summary> 패턴 (DisclosureFold 동형).
 *   - ADR-0050 §D6 다크패턴 회피:
 *       - 단일 색상 (활성 = bg-fg, 비활성 = border-fg/15).
 *       - 1위 임의 하이라이트 0 / "추천" 라벨 0 / 색상 다중화 0.
 *   - 모바일: flex-wrap + overflow-x-auto 조합으로 가로 스크롤 / wrap 적응.
 *   - 인쇄: print:hidden (클릭 불가 URL 노이즈).
 *
 * i18n: getTranslations (RSC) — 'result.sortTabs' 네임스페이스.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import {
  buildSortHref,
  SORT_TAB_KEYS,
  type SortTabKey,
  type ViewState,
} from '../_lib/compare-view';

// ─── Props ────────────────────────────────────────────────────────────────

export interface SortTabsProps {
  /** /r/{shortId} 기반 경로. 정렬 href 구성용. */
  readonly basePath: string;
  /** 현재 URL 에서 파싱된 ViewState. */
  readonly view: ViewState;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export async function SortTabs({ basePath, view }: SortTabsProps) {
  // why: RSC 이므로 getTranslations 사용. 'result.sortTabs' 네임스페이스.
  const t = await getTranslations('result.sortTabs');

  // 현재 활성 탭: SortTabKey 범위 밖이면 'cheapest' fallback.
  const activeTab: SortTabKey =
    (SORT_TAB_KEYS as readonly string[]).includes(view.sort)
      ? (view.sort as SortTabKey)
      : 'cheapest';

  return (
    <div
      // print:hidden — 인쇄 시 클릭 불가 탭은 노이즈.
      className="print:hidden flex flex-col gap-2"
    >
      {/* 탭 행 — 모바일 wrap + 데스크톱 한 줄 */}
      <div
        role="group"
        aria-label={t('ariaLabel')}
        className="flex flex-wrap gap-2"
      >
        {SORT_TAB_KEYS.map((key) => {
          const active = activeTab === key;
          // why: i18n 키 = result.sortTabs.{key} (cheapest / most_saved / best_value / most_reliable)
          const label = t(key as Parameters<typeof t>[0]);
          return (
            <Link
              key={key}
              href={buildSortHref(basePath, view, key)}
              aria-current={active ? 'page' : undefined}
              // ADR-0050 §D6: 단일 색상 — 활성 = bg-fg text-bg, 비활성 = border bg-bg.
              // "추천" / 강조 라벨 0. 1위 임의 하이라이트 0.
              className={
                active
                  ? 'rounded-full bg-fg px-4 py-1.5 text-xs font-medium text-bg'
                  : 'rounded-full border border-fg/15 bg-bg px-4 py-1.5 text-xs font-medium text-fg-soft transition hover:border-fg/30'
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* "Why this order?" 펼침 (ADR-0050 §D3 algorithmic transparency) */}
      <details className="group">
        <summary
          // why: list-none 으로 기본 삼각형 숨김 → ⓘ 아이콘 단독 (DisclosureFold 패턴 정합).
          //      cursor-pointer 명시 (Safari 미설정 이슈).
          className="flex cursor-pointer list-none items-center gap-1 text-xs text-fg-soft hover:text-fg"
        >
          <span aria-hidden="true" className="text-[11px]">
            ⓘ
          </span>
          <span>{t('whyThisOrder.summary')}</span>
        </summary>
        {/* 펼침 본문 — 현재 정렬 알고리즘 설명 (1~2문장) */}
        <p className="mt-1.5 text-xs leading-relaxed text-fg-soft">
          {t(`whyThisOrder.${activeTab}` as Parameters<typeof t>[0])}
        </p>
      </details>
    </div>
  );
}
