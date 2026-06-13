/**
 * DisclosureFold — 디스클로저 `<details>` 펼침 (ADR-0050 §D2, 원칙 6).
 *
 * 설계:
 *   - 닫힌 상태 = 행 높이 균일 잠금 (extraneous load 외화).
 *   - `<summary>` = ⓘ 아이콘 + aria-label.
 *   - 펼침 본문 = AffiliateDisclosureLine 기존 텍스트 보존.
 *   - RSC 호환 — `<details>` 는 HTML native, JS 불필요.
 *   - 인쇄 시: `print:open` pseudo는 CSS에서 불가 → 펼침 본문을 print에서
 *     항상 노출 (`[open]` 없이도 print:block 적용).
 */

// ─── Props ────────────────────────────────────────────────────────────────

export interface DisclosureFoldProps {
  /** <summary> 텍스트 (번역됨). */
  readonly summaryLabel: string;
  /** <summary> aria-label (번역됨, 공급사명 포함). */
  readonly summaryAriaLabel: string;
  /** 펼침 본문 (번역됨). */
  readonly children: React.ReactNode;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────

export function DisclosureFold({
  summaryLabel,
  summaryAriaLabel,
  children,
}: DisclosureFoldProps) {
  return (
    <details className="group mt-2">
      <summary
        aria-label={summaryAriaLabel}
        // why: list-none 으로 기본 삼각형 숨김 → ⓘ 아이콘 단독.
        //      cursor-pointer 명시 (Safari 미설정 이슈).
        className="flex cursor-pointer list-none items-center gap-1 text-xs text-fg-soft hover:text-fg"
      >
        {/* 정보 아이콘 — 유니코드 ⓘ (외부 아이콘 라이브러리 의존 0). */}
        <span aria-hidden="true" className="text-[11px]">
          ⓘ
        </span>
        <span>{summaryLabel}</span>
      </summary>
      {/* 펼침 본문 — 인쇄 시 항상 노출. */}
      <div className="mt-1.5 text-xs text-fg-soft print:block">
        {children}
      </div>
    </details>
  );
}
