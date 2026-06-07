/**
 * deriveCaveats — caveat 자동 생성 순수 함수 (PLAN 1.13 함수 차원)
 *
 * 결정 근거: docs/adr/0010-comparison-engine.md §T6
 *
 * 왜 별도 파일인가?
 *   T6 규칙이 8건 (페이즈 1) — compare.ts 안에 두면 비교 산식 가독성 ↓.
 *   1.13 사용자 노출 (페이즈 3.5) 시 결과 카드 컴포넌트도 직접 import 가능.
 *
 * 왜 nl-BE 단일 문자열인가?
 *   ADR-0010 §T6: 페이즈 1~4 시점 i18n 인프라 (next-intl) 미도입. 페이즈 2
 *   도입 시 일괄 변환 (자동화 가능). 키화는 빈 키 file 만 만들고 솔로 디버깅
 *   부담만 추가됨.
 *
 * 순수성:
 *   - 입력 동일하면 출력 동일 (순서 결정적, Date.now() 호출 X)
 *   - 입력 변형 X (readonly 강제)
 */

import type { TariffSnapshotLike, UsageProfile } from './types';

// ─── 입력 ─────────────────────────────────────────────────────────────────

export interface DeriveCaveatsInput {
  readonly candidate: TariffSnapshotLike;
  /** null = 신규 가입자 (currentTariff 없음). */
  readonly currentTariff: TariffSnapshotLike | null;
  readonly usageProfile: UsageProfile;
  /**
   * ADR-0013 Amendment 1 — raw_payload.stub 트리거.
   * true = 운영자 수동 입력 추정값 → caveat 규칙 9 트리거.
   * 기본 false (stub 키 없음 = 페이즈 5+ 실 데이터).
   */
  readonly isStub?: boolean;
}

// ─── 표시 helper (cents → € 사람 친화 문자열) ─────────────────────────────

/**
 * cents → "€X" / "€X.YZ" 사람 친화 문자열 (nl-BE).
 *
 * 왜 Intl.NumberFormat 을 직접 쓰지 않는가?
 *   PriceWithSource (`src/components/PriceWithSource.tsx`) 가 사용자 노출의
 *   단일 변환 지점이다 (P1 + ADR-0005 §T2 표시 정책). 본 함수는 *caveat 텍스트
 *   안의 가격* — UI 가 아닌 텍스트. 단순 정수 변환으로 충분.
 *
 * 왜 정수와 소수 자리를 분리하는가?
 *   €25 (=2500 cents) 는 "€25" 로 표시 — 0 소수는 미관 손실.
 *   €25.50 (=2550 cents) 는 "€25.50" 으로 표시.
 */
function formatCentsAsEuro(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const subCents = abs % 100;
  if (subCents === 0) return `${sign}€${euros}`;
  // 왜 padStart(2, '0') 인가?
  //   €25.50 → 50 / €25.05 → 05 / €25.5 처럼 한 자리는 거짓.
  return `${sign}€${euros}.${subCents.toString().padStart(2, '0')}`;
}

// ─── 핵심 함수 ────────────────────────────────────────────────────────────

/**
 * caveat 자동 생성. ADR-0010 §T6 매트릭스 8 규칙.
 *
 * 출력 순서:
 *   1. 약정 길이 (24m / 12m / 그 외)
 *   2. 활성화 비용
 *   3. 프로모 길이 (12개월 미만)
 *   4. 데이터 한도 초과 (mobile)
 *   5. EU 로밍 미포함 (mobile)
 *   6. 4K 권장 속도 부족 (internet_fixed)
 *   7. candidate confidence='medium'
 *   8. currentTariff confidence != 'high'
 *
 * 왜 결정적 순서가 중요한가?
 *   PLAN 3.5 결과 페이지 (영구 링크) 가 *동일 결과를 항상 동일 순서로* 보여줘야
 *   함. 사용자가 같은 비교를 두 번 봤을 때 caveat 순서가 달라지면 신뢰 손실
 *   (P3 위반).
 */
export function deriveCaveats(input: DeriveCaveatsInput): string[] {
  const { candidate, currentTariff, usageProfile, isStub = false } = input;
  const caveats: string[] = [];

  // ─── 1. 약정 길이 ───────────────────────────────────────────────────────
  // 왜 >= 24 와 12-23 분리 인가?
  //   ADR-0005 §외부 사실: Telenet 번들이 24개월, 일반 인터넷이 12개월.
  //   24개월은 *약정 부담이 큰* 시그널, 12개월은 *표준 약정* 시그널 — 사용자
  //   체감 다름.
  if (candidate.commitmentMonths >= 24) {
    caveats.push(
      `${candidate.commitmentMonths}개월 약정 — 조기 해지 시 위약금 발생`,
    );
  } else if (candidate.commitmentMonths >= 12) {
    caveats.push(
      `${candidate.commitmentMonths}개월 약정 — 조기 해지 시 위약금 발생`,
    );
  }
  // commitmentMonths 0 = non-binding → caveat 0 (Proximus 광고 카테고리)

  // ─── 2. 활성화 비용 ─────────────────────────────────────────────────────
  // 왜 > 0 만? — 0 은 무료 (caveat X), null 은 정의되지 않음 (NOT NULL 컬럼이라
  // null 이 오면 fetcher 버그). 양수일 때만 caveat.
  if (candidate.activationFeeCents > 0) {
    caveats.push(
      `활성화 비용 ${formatCentsAsEuro(candidate.activationFeeCents)} 별도 (1회성)`,
    );
  }

  // ─── 3. 프로모 길이 (12개월 미만) ───────────────────────────────────────
  // 왜 12개월 미만만? — 12개월 평균 시나리오 (T3 1차 표시) 에서 *프로모가 다
  // 끝나지 않는* 경우는 caveat 가치 ↓. 프로모가 12개월 안에 끝나면 13개월차
  // 부터 정상가로 전환 — 사용자가 알아야 함.
  if (
    candidate.promoMonths !== null &&
    candidate.promoMonths > 0 &&
    candidate.promoMonths < 12 &&
    candidate.promoPriceCents !== null
  ) {
    caveats.push(
      `프로모 가격은 첫 ${candidate.promoMonths}개월만 — 이후 ${formatCentsAsEuro(candidate.monthlyPriceCents)}/월`,
    );
  }

  // ─── 4. 데이터 한도 초과 (mobile) ───────────────────────────────────────
  // 왜 candidate 가 아닌 currentTariff 의 한도 초과를 보지 않는가?
  //   사용자가 *후보* 로 변경했을 때의 영향이 1차 가치. currentTariff 한도
  //   초과는 케이스 3에서 별도 caveat 으로 후속 추가 가능 (Amendment).
  if (candidate.category === 'mobile') {
    const dataGb = candidate.attributes['data_gb'];
    const usedGb = usageProfile.data_gb_used;
    // 왜 typeof 검사인가?
    //   data_gb 는 number | 'unlimited'. 'unlimited' 시 caveat X.
    //   number 일 때만 비교.
    if (
      typeof dataGb === 'number' &&
      typeof usedGb === 'number' &&
      usedGb > dataGb
    ) {
      caveats.push(
        `월 ${usedGb}GB 사용 → 본 요금제 ${dataGb}GB 초과. 한도 초과 비용은 표시되지 않습니다.`,
      );
    }
  }

  // ─── 5. EU 로밍 미포함 (mobile) ─────────────────────────────────────────
  // 왜 attributes['eu_roaming_included'] === false 인가?
  //   undefined 일 수도 있음 (fetcher 가 키 누락) — 그 케이스는 caveat X
  //   (정보 부재를 거짓 정보로 만들지 않음, P1).
  if (
    candidate.category === 'mobile' &&
    candidate.attributes['eu_roaming_included'] === false
  ) {
    caveats.push('EU 로밍 미포함');
  }

  // ─── 6. 4K 스트리밍 권장 속도 (internet_fixed / bundle_* 모두) ─────────
  // 왜 100 Mbps 임계인가?
  //   업계 권장 4K UHD 스트리밍 = 25 Mbps/스트림. 가구 동시 다중 (2-4 stream)
  //   고려 시 100 Mbps 가 안전 floor. 임계는 페이즈 5 OCR + 사용자 데이터 후
  //   재조정 가능 (Amendment).
  // ADR-0042 §D1: bundle_mobile_internet / bundle_mobile_internet_tv 추가 — 인터넷 포함 카테고리 전체.
  if (
    (candidate.category === 'internet_fixed' ||
      candidate.category === 'bundle_internet_tv' ||
      candidate.category === 'bundle_mobile_internet' ||
      candidate.category === 'bundle_mobile_internet_tv') &&
    usageProfile.streaming_4k === true
  ) {
    const downloadMbps = candidate.attributes['download_mbps'];
    if (typeof downloadMbps === 'number' && downloadMbps < 100) {
      caveats.push(
        `4K 스트리밍에 권장 100 Mbps 미만 (본 요금제 ${downloadMbps} Mbps)`,
      );
    }
  }

  // ─── 7. candidate confidence='medium' ───────────────────────────────────
  // 왜 'low' 는 안 다루는가?
  //   compare() 가 입력 단계에서 'low' 후보를 제외 (T5). 여기 도달하는 candidate
  //   는 medium 또는 high — medium 만 caveat.
  if (candidate.confidence === 'medium') {
    const reason = candidate.confidenceReason ?? '셀렉터 fragile 또는 파싱 경고';
    caveats.push(`비교 데이터 신뢰도: medium (${reason})`);
  }

  // ─── 8. currentTariff 신뢰도 ────────────────────────────────────────────
  // 왜 currentTariff 가 high 가 아니면 caveat? — 비교 *기준* 의 신뢰도가 낮으면
  // 절약액 자체의 정밀도가 낮음. 사용자에게 *기준의 한계* 를 노출 (P3).
  if (currentTariff && currentTariff.confidence !== 'high') {
    caveats.push(`현재 요금제 데이터 신뢰도: ${currentTariff.confidence}`);
  }

  // ─── 9. stub 추정값 (ADR-0013 Amendment 1) ──────────────────────────────
  // 왜 isStub 트리거인가?
  //   raw_payload.stub === true = 운영자 2026-05-09 수동 검증 추정값.
  //   페이즈 5 이전까지 실시간 스크래핑 데이터가 없으므로 *모든 현 단계 row* 가
  //   해당. 사용자에게 "추정값임"을 짧게 고지 (P1 + ADR-0013 Amendment 1).
  //   긴 고지는 BetaEstimatedBanner (배너) 에서 담당 — 여기는 caveat 단 1줄.
  if (isStub === true) {
    caveats.push('추정값 — 실 데이터 페이즈 5 이후');
  }

  return caveats;
}
