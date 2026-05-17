# ADR-0009: PLAN 1.8 fetcher 갯수 축소 — 3개 → 2개 (Proximus + Telenet)

## Status

> **⚠️ DEPRECATED (2026-05-17, [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D4)**
> — 본 ADR 의 핵심 결정 1 ("2 공급사 Proximus+Telenet, Orange BE 페이즈 5
> 이연, 좁고 깊은 포지셔닝")이 ADR-0034 D4 로 **전면 무효**: Proximus /
> Telenet / **Orange BE** / **Voo** 4 fetcher (순서 = Orange BE 먼저 → Voo
> 차순). §결정 2 (페이즈 1 일정 단축) / §검증 (M16 게이트) 도 ADR-0034 D2
> 로 무의미. amend 아닌 **deprecate** — "좁고 깊은 2 공급사" 정책 자체 폐기
> (amend 는 결정 1 잔존 오해 소지). **본문은 이력 보존을 위해 삭제하지
> 않는다** — Telecompaper Q1 2025 점유율 사실(Proximus 43 / Telenet 32 /
> Orange BE 22.5%)은 ADR-0034 D4 가 그대로 인용. 아래 원문은 *역사적 기록*.

~~Accepted (2026-05-09)~~ — **운영자 직접 결정** (Kim Wonmin, kim.wonmin91@gmail.com).
ADR-0003 §결정 6의 scope cut 옵션 **A** ("1.8 fetcher 3개 → 2개")를 명시적으로
채택. 본 ADR은 그 결정을 *기록*하고 *근거를 정리*한다. 인터페이스 결정
([ADR-0008](0008-fetcher-interface-and-cron.md))은 그대로 유지 — 본 ADR은
*갯수*만 변경한다. (DEPRECATED 2026-05-17 — ADR-0034 D4 가 4 공급사로 전면
무효, 위 헤더 참조.)

## Context

### 운영자 사실 (`docs/FOUNDER.md`)

- 솔로 사이드, 주 10-20시간, 월 €300 ALL-IN 예산
- TVA 대기 중, 비즈니스 계좌 미개설
- 페이즈 1 일정 = M1~M3 (3개월) — ADR-0003 §결정 5

### ADR-0003 §결정 6 — Scope cut 옵션 A

PLAN.md 끝의 옵션 A는 다음과 같이 명시되어 있었다:

> 옵션 A: 1.8 fetcher 3개 → 2개 (Proximus + Telenet)

하지만 채택 여부는 *운영자 페이즈 진입 시 의식적 선택* 으로 유보돼 있었다.
2026-05-09 운영자가 본 옵션을 **채택**하기로 결정 — 본 ADR은 그 결정의 형식
기록.

### ADR-0008 인터페이스 결정 — 변동 없음

- T1 `FetchResult.data = TariffSnapshotInput[]` 고정 모양
- T2 1 fetcher = 1 provider의 *모든* tariff
- T7 네트워크 step + DB step 분리
- T6 cron 일 1회 06:00 UTC

위 결정은 fetcher *갯수*에 의존하지 않는다. 본 ADR은 registry 길이만 3 → 2.

### 외부 사실 — BE 통신 시장 점유율 (검증된 출처, 2026-05-09)

| 출처 | 사실 |
|---|---|
| [Telecompaper Q1 2025 — Belgian Total Communications](https://www.telecompaper.com/research/belgian-total-communications-market-2025-q3--1555577) | Proximus ~43% 침투율, Telenet ~32% 매출 점유, Orange BE ~22.5% Q1 2025 |
| [Telecompaper 2024 — "Proximus grows market share in 2024"](https://www.telecompaper.com/news/proximus-grows-market-share-in-2024-at-expense-of-orange-telenet--1542475) | 2024년 Proximus 점유율 증가 (Orange/Telenet 손실) |
| [Mordor Intelligence — Belgium Telecom MNO Market](https://www.mordorintelligence.com/industry-reports/belgium-telecom-market) | Digi 진입(2024-12, €5/15GB)으로 모든 incumbent의 가격 인하 압박 |

**합산:** Proximus + Telenet ≈ **75%** (43% + 32%) 침투/매출 기준. 비교
대상으로 BE 통신 시장의 ¾ 이상을 다룬다 — 솔로 신생 사이트가 *베타에서*
"비교가 의미 있다"고 주장 가능한 최소 임계 (단일 후보 = 비교 무의미; 2개 =
경쟁 비교; ≥75% 점유 = 시장 대표성).

Orange BE 22.5%는 의미 있는 부재이지만, **페이즈 4.5 M16 평가 게이트** (ADR-0003
§결정 2: 매출 €1K/월 + CVR 3% + fetcher 95% + 주 10h 시간 여유)의 신호 측정에
방해되지는 않는다. 오히려 갯수를 줄여 신호 자체의 *깊이* (24h 신선도, 청구서
검증 정확도)를 확보하는 것이 우선.

## Decision

### 결정 1 — Orange BE 제외, Proximus + Telenet 2개 유지

PLAN 1.8을 다음과 같이 축소:

- `src/fetchers/proximus.ts` — Proximus 모바일/인터넷
- `src/fetchers/telenet.ts` — Telenet 모바일/인터넷
- 각 fetcher 단위 테스트 1개 (총 2개)

Orange BE는 **페이즈 5에서 평가 후 추가** (5.1 에너지 BE와 동등한 후보군 진입).

**근거:**
- BE 통신 시장 ≥ 75% 점유 합산 → 비교의 시장 대표성 충족 (Telecompaper Q1 2025)
- 2개 = 경쟁 비교 가능한 최소치 (단일 후보는 절약액 비교 자체 무의미)
- M16 평가 게이트 신호의 *깊이* (24h 신선도, 1.12 청구서 12케이스 검증) 우선
  > *너비* (3 fetcher 폭)
- ADR-0003 §결정 2의 4개 통과 조건은 fetcher 갯수에 의존하지 않음 — 매출/CVR/
  안정성/시간

**미래 Orange BE 추가 경로 (페이즈 5):**
- 게이트 통과 시 페이즈 5에서 5.1 (에너지 BE) 또는 Orange BE 둘 중 우선순위
  결정. 신호: M16 시점에 사용자 요청 빈도 (`/data-sources` 페이지에 "Orange
  BE 비교 요청" 버튼 노출 → click event 측정).
- `src/fetchers/orange-be.ts` 신설 시 ADR-0008 인터페이스 그대로 사용. registry
  배열에 1줄 추가 + 단위 테스트 1개. 추가 코드 ≈ 1주.

### 결정 2 — 페이즈 1 일정 1주 단축

ADR-0003 §결정 5 페이즈 1 일정: M1~M3 (3개월). 내부 분해:

| 작업 | 가정 (3 fetcher) | 본 ADR 후 (2 fetcher) | Δ |
|---|---|---|---|
| 1.A 스키마 (1.1~1.5) | 1주 | 1주 | 0 |
| 1.6/1.7 인프라 + 인터페이스 | 1주 | 1주 | 0 |
| **1.8 fetcher 실 구현** | **3주 (1주 × 3)** | **2주 (1주 × 2)** | **-1주** |
| 1.9 / 1.10 (격리 + 투명성) | 0.5주 | 0.5주 | 0 |
| 1.11~1.13 비교 엔진 + 12케이스 + caveats | 4주 | 4주 | 0 |
| 운영 부채/라이브러리 호환성 버퍼 | 2주 | 2주 | 0 |
| **합계** | **11.5주 ≈ M1~M3** | **10.5주 ≈ M1~M3 (-1주)** | **-1주** |

**효과:** 1주 마진을 **1.12 청구서 12개 수집** (실 영수증 수집이 솔로에서
가장 타이트한 작업) 또는 페이즈 1.5 운영 부채에 흡수.

### 결정 3 — 운영 부채 영향 (1.5.1 fetcher 공통화)

PLAN 1.5.1 ("Fetcher 코드 공통화 — 3개 fetcher의 중복 추출")은 **본 ADR로 가치
저하**.

- 2개에서 패턴 추출 = N=2 표본, 휴리스틱(중복 ≥ 3회)으로는 너무 작음
- 그러나 1.5.1을 *제거*하지는 않음 — Orange BE 페이즈 5 추가 시 N=3이 되어
  공통화 가치가 *돌아옴*. 1.5.1 본문은 "추출 후보가 충분치 않으면 *대기*" 라고
  명시될 예정 (1.5.1 진입 시 builder가 판단).

### 결정 4 — 베타 모집 (PLAN 4.6) — 헌법 P3 정합

베타 100명(또는 옵션 E의 50명)에게 "Proximus + Telenet만 비교됨" 사실을 어떻게
전달할 것인가:

- **`/data-sources` (PLAN 1.10)**: 제외 공급사 섹션에 **"Orange BE — 페이즈 5
  에서 평가 후 추가 예정"** 명시. 헌법 §8 #1과 P3 ("제외된 공급사도 이름 밝힘")
  정합.
- **베타 모집 카피**: "현재 BE 시장 ≥ 75% 점유 2개 공급사를 깊이 있게 비교
  중입니다 — Orange BE는 다음 페이즈에서 추가합니다." 솔로 신생 사이트의
  *비교 좁은 폭 + 깊은 신뢰* 포지셔닝과 일관.
- 결과 페이지(PLAN 3.4 "제외된 공급사 섹션")에서도 동일 문구 노출.

## Alternatives considered

### 대안 A — 3개 유지 (ADR-0003 원안)

- **장점:** Orange BE 22.5% 점유까지 포괄, 시장 대표성 ≥ 97%
- **단점:**
  - 페이즈 1에 +1주 추가 → 운영자 시간 압박 가중 (주 10-20시간 솔로)
  - 1.12 12케이스 청구서 수집 (가장 타이트한 작업) 시간 잠식
  - M16 평가 게이트의 4개 신호 자체가 fetcher 갯수가 아니라 매출/CVR/안정성/
    시간이라 *3 fetcher 폭이 신호를 강화하지 않음*
- **거부 사유:** 시간 비용 vs 신호 가치 불균형. Orange BE는 페이즈 5에서 신호
  기반(사용자 요청 빈도) 추가 가능 — 페이즈 1에서 강제할 가치 없음.

### 대안 B — 1개로 더 축소 (Proximus only)

- **장점:** 페이즈 1 추가 -1주 단축
- **단점:**
  - 비교 자체가 *의미 약함* — 절약액 비교는 *경쟁 후보 ≥ 2*가 필수
  - 단일 공급사 fetcher = "공식 사이트 가서 보세요"와 동등 (Slim의 가치 0)
  - M16 평가 게이트 CVR 3% 측정 자체가 무효화 (사용자가 "비교"가 아니라
    "Proximus 공식 페이지" 사용)
- **거부 사유:** 비교 플랫폼의 정체성을 깬다. 시간 절약이 헌법 P1 (정보
  우선)/ P3 (투명성) 위반을 정당화하지 않음.

## Consequences

### ✅ 얻는 것

- 페이즈 1 일정 1주 단축 → 1.12 청구서 12개 수집 또는 페이즈 1.5 부채 흡수에
  마진 확보
- M16 평가 게이트 신호의 *깊이* (24h 신선도, 청구서 검증 정확도) 우선 가능
- 솔로 디버깅 부담 -33% (fetcher 깨짐 빈도가 갯수에 비례)
- 베타 모집 카피의 *명확성* — "≥ 75% 점유 2개 공급사 깊이" 가 헌법 P3 정합

### ⚠️ 잃는 것 / 부채

- Orange BE 사용자(BE 시장 22.5%)가 *베타 시점에 비교 못 함* — `/data-sources`
  의 "Orange BE 비교 요청" CTA로 페이즈 5 우선순위 신호로 전환
- 1.5.1 fetcher 공통화 가치 *저하* — 페이즈 5에서 N=3 진입 시 회복
- 페이즈 5 진입 시 Orange BE 추가 vs 5.1 (에너지 BE) 우선순위 결정이 *추가
  결정점* — 별도 ADR 또는 PLAN 항목으로 처리

## 검증 방법

### 검증 1 — M16 평가 게이트 (ADR-0003 §검증 2)

페이즈 4.5 시점에 4개 신호 통과 여부 측정. 통과 시 본 ADR 채택 정당화 (2개
fetcher만으로도 매출/CVR/안정성/시간 기준 충족).

3개 이상 통과 시 → 본 ADR 정당화 + 페이즈 5에서 Orange BE 추가 우선순위 평가.
2개 이하 → ADR-0003 §결정 1 (카테고리 우선순위) 자체 재검토 (Orange BE 추가가
신호 부족의 원인이 아닐 가능성 큼).

### 검증 2 — 베타 사용자 신호 (`/data-sources` Orange BE CTA)

페이즈 4 베타 100명(또는 옵션 E 50명)에게 `/data-sources`의 "Orange BE 비교
요청" CTA 노출. M11 (베타 종료) 시점:

- click event ≥ 20% (베타의 1/5 이상 요청) → 페이즈 5에서 Orange BE 우선
- click event < 10% → 페이즈 5에서 5.1 (에너지 BE) 우선
- 10-20% → 운영자 판단 (시간 여유 + Orange BE 가격 페이지 fetcher 난이도 평가)

### 검증 3 — fetcher 안정성 (ADR-0008 §검증 5)

2 fetcher 일 1회 cron이 페이즈 4.5 M11 시점까지:
- step run 카운트 ≤ 4/cron (네트워크 + DB × 2 fetcher) — Inngest free 무료
  티어 0.4% × 2/3 = 0.27% 사용
- 30일 누적 fetcher 실패율 ≤ 5% (24h 신선도 ≥ 95% 직접 측정 — M16 게이트 조건)

## 영향

### PLAN.md 갱신 (본 ADR과 동시)

- **§1.8** 본문: fetcher 3개 → 2개 (Proximus + Telenet) 명시. DoD 갱신: fetcher
  파일 2개 + 단위 테스트 2개. Orange BE 페이즈 5 평가 후 추가 명시.
- **§1.10** 본문: 제외 공급사 섹션에 "Orange BE — 페이즈 5에서 평가 후 추가
  예정" 추가. 헌법 P3 정합.
- **§Scope cut 옵션** 표: 옵션 A 라인 → "**적용됨 (ADR-0009)**" 마킹.
- **§작업 추적 메타 표**: 페이즈 1 항목 수 13 → 13 (변경 없음 — 1.8 자체는
  제거 안 됨, 갯수만 축소).

### 다른 ADR과의 관계

- **ADR-0003 §결정 6**: 옵션 A 채택의 형식 기록. ADR-0003 본문 변경 없음.
- **ADR-0008 §T1~T10**: 인터페이스 결정 *그대로 유지*. registry 배열 길이만
  변경.
- **ADR-0005 / ADR-0006**: 스키마 결정 그대로. fetcher 갯수와 무관.

### MONETIZATION.md 영향 — 가정 변동 없음

§A CPA 단가 표 (모바일 €25 / 인터넷 €70 평균) 가정은 **변동 없음**:
- Proximus / Telenet / Orange BE 단가 분포는 비슷 (€15~€120 모바일+인터넷
  공통 범위)
- 매출 가정 (M8 €320 / M10 €1,125 / M16 €3,750)도 변동 없음 — fetcher 갯수가
  아니라 *비교 수 × 전환율 × 평균 단가*로 결정

페이즈 5 Orange BE 추가 시 별도 매출 영향 평가 (MONETIZATION-ACTUALS 분기 갱신).

## References

- 헌법: [`CLAUDE.md`](../../CLAUDE.md) — P1 (정보 우선), P3 (투명성, 제외
  공급사 명시), P5 (ADR)
- 운영자: [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 주 10-20시간
- 관련 ADR:
  - [ADR-0003](0003-plan-realism-solo-side.md) §결정 1 (카테고리 = 통신 BE),
    §결정 6 (scope cut 옵션 A)
  - [ADR-0008](0008-fetcher-interface-and-cron.md) — 인터페이스 결정 (본
    ADR이 *갯수*만 변경, 인터페이스는 동일)
  - [ADR-0004](0004-monetization-solo-side-rebalance.md) — CPA 단가 가정
    (변동 없음)
- 외부 사실 (BE 통신 시장 점유율):
  - [Telecompaper — Belgian Total Communications Q1 2025](https://www.telecompaper.com/research/belgian-total-communications-market-2025-q3--1555577)
  - [Telecompaper — Proximus grows market share in 2024](https://www.telecompaper.com/news/proximus-grows-market-share-in-2024-at-expense-of-orange-telenet--1542475)
  - [Mordor Intelligence — Belgium Telecom MNO Market](https://www.mordorintelligence.com/industry-reports/belgium-telecom-market)
- Inngest 무료 티어 (2 fetcher 사용량 재계산):
  - 2 fetcher × 일 1회 × 30일 = 60 events/월 (50k 한도의 0.12%)
  - 2 fetcher × 2 step × 일 1회 × 30일 = 120 step runs/월 (50k 한도의 0.24%)
