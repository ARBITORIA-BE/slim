/**
 * CarrierAvailabilityNotice — carrier 가용성 안내 (ADR-0043 §D5 + Q2).
 *
 * 헌법 §3 P1 + P3: "비교에서 제외된 공급사도 이름 공개" + "데이터로 보여준다".
 * 카테고리 무관 단일 매트릭스 (ADR-0043 Q3: 카테고리 분기 거부).
 *
 * 현재 매트릭스 (2026-06-08):
 *   Telenet = Flanders + Brussels 한정.
 *   Proximus / Orange BE = 벨기에 전국.
 *   NL(KPN) / LU(POST) = 페이즈 5 이전 비교 불가.
 *
 * 위치: ExcludedProvidersSection 인접 별 섹션 (의미 분리 — ADR-0043 Q2).
 * ExcludedProvidersSection 은 API 미제공 사유, 본 섹션은 지역 가용성 사실.
 *
 * i18n: getTranslations (RSC) — 'compare.carrierAvailability' 네임스페이스.
 *
 * source_url + fetched_at (헌법 §3 P1 데이터 계약):
 *   source: https://www.telenet.be/en/about-telenet/our-network (Telenet network coverage)
 *   fetched_at: 2026-06-08 (운영자 검증, ADR-0043 §D5)
 */

import { getTranslations } from 'next-intl/server';

export async function CarrierAvailabilityNotice() {
  // why: RSC 이므로 getTranslations 사용 (서버에서 locale 로드).
  const t = await getTranslations('compare.carrierAvailability');

  return (
    <section
      aria-labelledby="carrier-availability-heading"
      className="flex flex-col gap-3 rounded-2xl border border-fg/10 bg-bg p-6 text-sm"
    >
      <h2
        id="carrier-availability-heading"
        className="font-display text-base font-semibold tracking-tight text-fg"
      >
        {/* 섹션 heading — i18n 키 없이 인라인: notice 자체가 제목 역할. */}
        Telenet
      </h2>
      <p className="text-fg-soft leading-relaxed">
        {t('notice')}
      </p>
      {/* P1 데이터 출처 표기 — source_url + verifiedAt */}
      <footer className="text-xs text-fg-soft/70">
        <span>{t('sourceLabel')}</span>
        {' · '}
        <span>{t('verifiedAt')}</span>
      </footer>
    </section>
  );
}
