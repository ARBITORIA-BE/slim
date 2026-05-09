/**
 * Fetcher 인터페이스 + FetchResult 타입 (PLAN 1.7)
 *
 * 모든 외부 데이터 fetcher의 *공통 모양*. 1.8에서 추가될 Proximus / Orange BE /
 * Telenet 3개 fetcher가 본 파일의 인터페이스만 준수하면 1.6 cron이 자동 호출.
 *
 * 결정 근거: docs/adr/0008-fetcher-interface-and-cron.md
 *
 * 핵심 설계 원칙 (ADR-0008):
 *   T1. data 필드는 고정 모양 — TariffSnapshotInput[] 배열. 제네릭 X.
 *       (ADR-0005 + ADR-0006 스키마와 1:1 매핑 — fetcher가 매핑 책임)
 *   T2. 페치 단위 = 한 fetcher = 한 provider의 *모든* tariff (배열로 반환)
 *       (Inngest free 50k exec/월 한도 보호 — 555배 안전 마진)
 *   T3. confidence = 표준 휴리스틱(computeConfidence, 1.8 신설) + fetcher
 *       자체 down-grade override (up-grade는 거부 — 휴리스틱이 보수적이라야 안전)
 *   T4. 결과는 discriminated union — { ok: true; result } | { ok: false; error }
 *       (부분 성공 표현 + type-narrow 정확 + 1.9 격리 메커니즘)
 *   T5. metadata는 인터페이스 안 + registry는 src/fetchers/index.ts (둘 다 필요)
 *
 * P1 (정보 우선) — harness:data Rule 1이 src/fetchers/**\/*.ts (이 파일 + 테스트
 * 제외)에서 `FetchResult` 식별자 존재를 검증한다. 본 파일은 인터페이스 정의 위치
 * 자체이므로 Rule 1의 ignore 목록에 포함됨.
 */

import type { TariffCategory } from '@/db/schema/tariff';
import type { Confidence } from '@/db/schema/tariff_snapshot';

// ─── Metadata ─────────────────────────────────────────────────────────────

/**
 * Fetcher의 운영 메타데이터. /data-sources 페이지(1.10)가 표시할 정보의 *진실
 * 단일 출처* — provider 마스터(ADR-0001)는 세무/계약 상태, fetcher metadata는
 * "어떻게 가져오는지" (P3 투명성).
 *
 * 한 provider에 두 fetcher가 붙는 시나리오(예: 같은 공급사의 mobile/internet
 * 페이지가 다른 도메인) 도 자연스럽게 표현됨 — providerSlug 만 같게 두면 됨.
 */
export interface FetcherMetadata {
  /** provider.slug FK — cron의 마스터 upsert lookup 키. */
  readonly providerSlug: string;
  /** /data-sources 노출용 사람 친화 이름 (예: "Proximus"). */
  readonly displayName: string;
  /** 베네룩스 3국 — provider.country와 일치해야 함. */
  readonly country: 'BE' | 'NL' | 'LU';
  /**
   * 데이터 수집 방법 — P3 (투명성은 운영자의 짐). 사용자가
   * "이건 사람이 정리한 거구나" / "API니까 신선하구나"를 알아야 함.
   *   api      — 공식 API 응답 (가장 신뢰)
   *   scraping — HTML 파싱 (셀렉터 fragile 위험)
   *   manual   — 운영자가 손으로 입력 (캐치업용)
   *   stub     — 개발용 고정 데이터 (페이즈 1 스텁 fetcher — ADR-0011 §T2 항목 3).
   *              P1 정직성: confidence='low' + 이 라벨로 사용자에게 스텁임을 노출.
   *              1.5.6 실 스크래핑 전환 시 'stub' → 'scraping' 으로 단일 라벨 변경.
   *              ADR-0008 Amendment 1 트리거: 본 변경의 형식 근거는 ADR-0011 §T2 항목 3.
   */
  readonly method: 'api' | 'scraping' | 'manual' | 'stub';
  /**
   * 버전 식별자. ADR-0006 §T3 rawPayload.fetcher_version 으로 그대로 미러됨.
   * 권장 형식: "<providerSlug>@<YYYY-MM-DD>" (예: "proximus-be@2026-05-09").
   */
  readonly version: string;
  /** 공식 홈페이지 — /data-sources 외부 링크 (P1 3층 원본 링크). */
  readonly homepageUrl: string;
}

// ─── Snapshot input — fetcher 출력 모양 ─────────────────────────────────────

/**
 * Fetcher가 한 tariff에 대해 산출하는 *snapshot 입력*. 1.6 cron이 이 모양을
 * 받아서 (1) tariff 마스터 upsert (providerSlug + tariffSlug 키) (2)
 * tariff_snapshot insert 두 단계에 *그대로 매핑*한다.
 *
 * ADR-0005 (tariff 마스터) + ADR-0006 (tariff_snapshot 시계열) 스키마가 본 모양을
 * 결정함. 필드 추가/변경은 두 ADR 중 하나의 Amendment를 요구한다.
 *
 * P4 (타입 안전):
 *   - 가격은 모두 정수 cents (number). null = 해당 개념 없음 (예: 모바일에
 *     modem rental).
 *   - attributes는 카테고리별 변동 — 컴파일 타임 안전은 Zod 스키마
 *     (src/types/tariff-attributes.ts, 1.8 신설)가 런타임으로 강제.
 */
export interface TariffSnapshotInput {
  // ─── 마스터 식별자 ────────────────────────────────────────────
  /** provider.slug FK lookup 용. fetcher metadata.providerSlug 와 일치. */
  readonly providerSlug: string;
  /** tariff.slug — (providerId, slug) UNIQUE. kebab-case. */
  readonly tariffSlug: string;
  /** 표시용 요금제 이름 (예: "Mobile Smart 70 GB"). */
  readonly tariffName: string;
  /** ADR-0005 §T6 enum 4값 (mobile/internet_fixed/bundle_internet_tv/landline). */
  readonly category: TariffCategory;

  // ─── 가격 (cents) — ADR-0005 §T2 + ADR-0006 §T2 평탄화 5컬럼 ───
  /** 정상 월정액 (cents, EUR). 항상 NOT NULL — 비교 엔진(1.11) 제1 입력. */
  readonly monthlyPriceCents: number;
  /** 1회성 활성화 비용 (cents). 무료면 0. */
  readonly activationFeeCents: number;
  /** 모뎀 임대비 월 (cents). null = 모뎀 임대 개념 없음 (모바일). */
  readonly modemRentalCents: number | null;
  /** 프로모 적용 가격 (cents). null = 프로모 없음. */
  readonly promoPriceCents: number | null;
  /** 프로모 지속 개월. null = 프로모 없음. */
  readonly promoMonths: number | null;
  /** 프로모 사람 친화 설명 (예: "처음 6개월 €10 할인"). null = 프로모 없음. */
  readonly promoDescription: string | null;

  // ─── 약정 — ADR-0005 §T3 ──────────────────────────────────────
  /** 약정 기간 (월). 0 = 약정없음 (Proximus "non-binding"). */
  readonly commitmentMonths: number;
  /** 조기 해지 위약금 (cents). null = 약정없음 또는 미상. */
  readonly earlyTerminationFeeCents: number | null;

  // ─── 카테고리별 변동 속성 — ADR-0005 §T1 JSONB ────────────────
  /**
   * 카테고리별 변동 키. mobile은 data_gb / voice_minutes 등, internet_fixed는
   * download_mbps 등. 단일 출처 = src/types/tariff-attributes.ts (Zod, 1.8).
   *
   * fetcher가 잘못된 키를 넣으면 컴파일 타임 못 잡고 런타임에 cron persist
   * step에서 Zod safeParse로 잡힘 → confidence='low' + Sentry 알림.
   */
  readonly attributes: Readonly<Record<string, unknown>>;

  // ─── 시계열 메타 — ADR-0006 NOT NULL ──────────────────────────
  /**
   * 이 스냅샷이 추출된 *정확한* 페이지 URL. 마스터(tariff.sourceUrl)와 다를 수
   * 있음 (예: 마스터는 /mobile-subscription, 스냅샷은 /mobile-subscription/smart).
   */
  readonly sourceUrl: string;
  /** ADR-0006 §T4 — 3값 enum. computeConfidence() 휴리스틱이 결정 (T3). */
  readonly confidence: Confidence;
  /**
   * 신뢰도 근거 — 운영자 자가 진단 자유 텍스트. UI 기본 노출 X.
   * 예: "selector .price--current matched 1; sanity check passed"
   */
  readonly confidenceReason: string | null;
  /**
   * ADR-0006 §T3 — 정규화 JSON only (HTML 단편 X). 권장 키:
   *   { fetcher_version, url, extracted, warnings, http: { status, elapsed_ms } }
   */
  readonly rawPayload: Readonly<Record<string, unknown>>;
}

// ─── Fetch outcome — discriminated union (T4) ────────────────────────────

/**
 * Fetcher 한 회 실행의 *성공* 결과. 한 provider의 모든 tariff snapshot 입력을
 * 배열로 담는다 (T2 페치 단위).
 *
 * 본 타입 이름 `FetchResult`는 harness:data Rule 1이 검증하는 식별자 — 변경
 * 시 harness 동시 갱신 필요.
 */
export interface FetchResult {
  /** fetcher metadata.providerSlug 와 일치. cron이 매핑 검증에 사용. */
  readonly fetcherSlug: string;
  /**
   * Fetcher 입장 수집 시각 (ISO 8601). cron이 ADR-0006 fetched_at 컬럼으로
   * 그대로 사용 (timestamptz). createdAt(DB insert 시각)과 다를 수 있음 —
   * 디버깅용 분리.
   */
  readonly fetchedAt: string;
  /** 한 provider의 *모든* tariff. 빈 배열도 정상 (페이지에서 모든 요금제 제거 케이스). */
  readonly data: readonly TariffSnapshotInput[];
}

/**
 * Fetcher 한 회 실행의 *실패* 결과. P1 (정보 우선) — 실패도 시각 + 부분 raw로
 * 사후 분석 가능해야 함.
 *
 * cron의 1.9 격리 메커니즘: `if (!outcome.ok) { logger.error(...); continue; }`
 * 다음 fetcher로 진행 — 한 fetcher 폭발이 다른 fetcher에 영향 0.
 */
export interface FetchError {
  readonly fetcherSlug: string;
  /** 실패 시각 — 사후 분석 단일 진입점. */
  readonly fetchedAt: string;
  /**
   * 실패 분류 — Sentry 그룹핑 + 운영자 우선순위 결정에 사용.
   *   network — HTTP 에러, timeout, DNS 등 (재시도 가치 ↑)
   *   parse   — HTML 셀렉터 깨짐 / Zod 검증 실패 (fetcher 코드 수정 필요)
   *   sanity  — 가격이 0/음수/비현실 (셀렉터는 매칭됐지만 값이 이상)
   *   unknown — 분류 불가 (fallback)
   */
  readonly kind: 'network' | 'parse' | 'sanity' | 'unknown';
  readonly message: string;
  /**
   * 부분 raw payload — fetcher가 일부 추출했다면 디버깅용으로 보존. 없으면 생략.
   * (exactOptionalPropertyTypes 친화 — undefined 명시 X, 키 자체 부재)
   */
  readonly rawPayload?: Readonly<Record<string, unknown>>;
}

/**
 * Fetcher 실행 결과 — discriminated union (T4).
 *
 * 사용 패턴:
 *   const outcome = await fetcher.fetch();
 *   if (!outcome.ok) {
 *     logger.error({ kind: outcome.error.kind, ... });
 *     return; // 다음 fetcher로 진행 (1.9)
 *   }
 *   // outcome.result 가 FetchResult로 narrow됨
 */
export type FetchOutcome =
  | { readonly ok: true; readonly result: FetchResult }
  | { readonly ok: false; readonly error: FetchError };

// ─── Fetcher 인터페이스 ────────────────────────────────────────────────────

/**
 * 모든 fetcher가 구현해야 할 인터페이스 (T2 페치 단위 + T5 metadata).
 *
 * 1.8에서 src/fetchers/proximus.ts / orange-be.ts / telenet.ts 가 각각 한
 * `Fetcher` 객체를 default export — src/fetchers/index.ts (registry)가
 * 모아서 cron이 import.
 *
 * fetcher는 throw 하지 않는 것을 권장 — 모든 실패는 FetchOutcome.ok=false 로
 * 반환해 부분 raw 보존 + type-safe 격리. 단 cron의 step.run() 자체가 unhandled
 * throw도 catch하므로 안전망 이중.
 */
export interface Fetcher {
  /** 운영 metadata — /data-sources(1.10) + cron 호출 단일 진입점. */
  readonly metadata: FetcherMetadata;
  /**
   * 한 회 실행. 30s 안에 완료 권장 (Inngest free step timeout 보수 가정 +
   * AbortController 25s 명시 권장 — 5s DB write 마진).
   */
  fetch(): Promise<FetchOutcome>;
}
