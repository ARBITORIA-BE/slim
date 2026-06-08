/**
 * CarrierAvailabilityNotice — carrier 가용성 안내 RSC (ADR-0043 §D3).
 *
 * 헌법 §3 P1 (정보 우선): source + verifiedAt 명시.
 * 헌법 §3 P3 (투명성): Telenet Wallonia 미커버 사실 정직 표시.
 * 다크패턴 0 — 헌법 §8 #3 정합 (중립 안내, 사용자 압박 없음).
 *
 * 배치: 결과 페이지 `/r/[shortId]` 의 ExcludedProvidersSection 인접 별 섹션.
 * 카테고리 무관 — Telenet 매트릭스는 mobile/internet_fixed/bundle_* 모두 동일
 * (ADR-0043 §D3 Q3: 카테고리 무관 architect 디폴트).
 *
 * i18n: getTranslations (RSC) — 'compare.carrierAvailability' 네임스페이스.
 *
 * 왜 별 섹션인가?
 *   ExcludedProvidersSection = "API 미제공 등으로 비교 자체 불가" 공급사.
 *   CarrierAvailabilityNotice = "지역 커버리지 한계로 일부 사용자에게 미해당" 정보.
 *   의미가 다르기 때문에 통합이 아닌 분리 (ADR-0043 §D3 Q2).
 */

import { getTranslations } from 'next-intl/server';

export async function CarrierAvailabilityNotice() {
  // why: RSC 이므로 getTranslations 사용 (await 가능).
  const t = await getTranslations('compare.carrierAvailability');

  return (
    <section
      aria-labelledby="carrier-availability-heading"
      className="flex flex-col gap-3 rounded-2xl border border-fg/10 bg-bg-warm/60 p-6"
    >
      <h2
        id="carrier-availability-heading"
        className="font-display text-lg font-semibold tracking-tight text-fg"
      >
        {/* 왜 하드코딩하지 않는가? 모든 사용자 노출 문자열은 i18n 단일 출처 (헌법 §8 #5 정합). */}
        {t('notice')}
      </h2>
      {/* source + verifiedAt: 헌법 §3 P1 — "출처 없는 숫자는 코드 리뷰에서 reject" */}
      <p className="text-xs text-fg-soft">
        {t('sourceLabel')} · {t('verifiedAt')}
      </p>
    </section>
  );
}
