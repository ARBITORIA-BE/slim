# ADR-0051: Organic SEO 콘텐츠 마케팅 트랙 — informational intent 가이드 5~10건 (ADR-0034 §D5 구체화)

## 상태

**Accepted (2026-06-24, 운영자 — architect 권고 묶음 잠금).**
**Amendment 1 Accepted (2026-07-08, 운영자 — §D1 MDX → TSX 정적 라우트 이전 트리거 확정).** ↓ §Amendment 1 참조.

운영자 잠금 결과:
- **Q1 = (a) `/guides/{slug}`** — 영역 분리 명확 + Check24 패턴 정합
- **Q2 = 권고 순서** — (1) Proximus vs Telenet vs Orange BE 비교 (head term, 최대 impressions 기대) → (2) 벨기에 모바일 평균 가격 가이드 (informational head term) → (8) 제외 공급사 정직 표시 (헌법 P3 차별화) 순으로 P1+P2 안 1건 + 운영자 트랙 후속.
- **Q3 = (나) 별 ADR-0052 신설** — P4 Pieter's picks 큐레이션 (ADR-0050 §빌드 분할 P4 + Q2=A `curated_pick` DB) = 영역 분리, 본 ADR 사이즈 cap 보존. ADR-0052 트리거는 P2 머지 후 별 트랙.
- **Q4 = (A) P1+P2 만** — 1 가이드 발행 → **3개월 SC 추적** → 효과 신호 후 P3~P5 진입. SC impressions 증가 + 색인된 페이지 증가 = 게이트 (운영자 회고).

PLAN 4.22 (P1 MDX 인프라 + 첫 가이드) + 4.23 (P2 i18n 4 locale + DeepL hybrid) 신설 후 P1 builder 진입 가능. **운영자 SC 5분 액션 (메시지 3건 / 필터 5개 제거 / 색인 누락 4 URL 정찰) 동반 트랙** = 본 ADR 데이터 게이트 강화 (별 트랙).

(이력) Proposed 2026-06-24 — 운영자 SC 데이터 회고 + 옵션 B 선택 트리거.

---

## 맥락 (Context)

### C1. Google Search Console 데이터 (slim.lu, sc-domain, 26.6.2 ~ 26.6.22)

ADR-0034 §D5 organic SEO 런치 (2026-06-05) 후 ~3주 누적 (운영자 회고):

| 메트릭 | 값 |
|---|---|
| 총 클릭수 | **0** |
| 총 노출수 | **8** |
| 평균 CTR | **0%** |
| 평균 게재순위 | **14.3** (페이지 2 = invisible) |
| 유일 검색어 | **"slim"** (게재순위 19.0) |
| 색인된 페이지 | **4** |
| 색인되지 않은 페이지 | **4** (50% 누락) |

**색인 누락 3가지 이유** (SC):
1. **리디렉션이 포함된 페이지** — ADR-0033 Amd 6 (5 locale → 3 통합)
   deprecated prefix 301 정상 (회귀 아님).
2. **크롤링됨 - 현재 색인이 생성되지 않음** — Google 권위 부족 패턴.
3. **발견됨 - 현재 색인이 생성되지 않음** — Google 권위 부족 패턴.

**GREEN**: Core Web Vitals (트래픽 부족으로 데이터 없음) / HTTPS / 직접
조치 / 보안 문제 / Sitemap (`/sitemap.xml` 2026-06-05 제출 / 2026-06-06
fetch 정상).

### C2. 진단 (architect)

1. **인지 0** — "slim" 은 영어 일반 형용사 (슬림체·다이어트·제품 등) =
   Google이 의도 모호어로 분류 → 권위 0 도메인은 페이지 2 (14.3 위) 잠금.
2. **베네룩스 의도 키워드 노출 0** — "vergelijk telecom" / "vergelijking
   proximus telenet" / "meilleur forfait mobile belgique" 같은
   informational + 비교 의도 키워드에서 노출 0 → 색인 자체가 검색
   pool 진입 X.
3. **백링크 0 → Google 권위 0** = 50% 색인 누락의 직접 원인 (Google PageRank
   알고리즘의 "discover but skip" 패턴).
4. **콘텐츠 깊이 부족** — 비교 페이지 (`/compare`, `/compare/mobile`,
   `/compare/internet_fixed`) + legal 페이지만 존재. SEO-friendly
   에디토리얼 콘텐츠 = 0. NerdWallet (US) / Check24 (DE) 모델은 "가이드
   글 100~500건 + 비교 도구" 의 하이브리드 = Slim 은 비교 도구 단독 +
   가이드 0건.

### C3. 운영자 옵션 분기 (이전 세션 잠금)

운영자가 이전 세션에서 5 옵션 중 선택:

| 옵션 | 판정 |
|---|---|
| A — 시간 대기 (3~6개월 추가) | ADR-0034 §D5 정합 — 수정 없이 대기 |
| **B — 콘텐츠 마케팅** | **운영자 선택 ⭐** — informational intent 가이드 5~10건 |
| C — 백링크 채널 | 정합 (외부 채널), 운영자 직접 트랙 |
| D — 유료 채널 (Google Ads) | ❌ ADR-0034 §결정 5 + 헌법 §8 #4 위반 거부 |
| E — 베타 모집 직접 | 정합, 별 트랙 |

운영자 **옵션 B** 선택 → 본 ADR 신설.

### C4. 영역 충돌 정찰 — ADR-0050 §D5 P4 Pieter's picks vs ADR-0051

- **ADR-0050 §D5 P4 Pieter's picks** = `/r/[shortId]` 결과 페이지 *내부*
  큐레이션 슬롯 3장 (Wirecutter "Our pick / Runner-up / Budget pick"
  모델) + DB 테이블 `curated_pick` (Q2=A 잠금) + bias-audit 시계열
  추적.
- **ADR-0051** = 신규 라우트 (`/guides/{slug}` 또는 동급) + MDX/RSC
  콘텐츠 + sitemap 신규 entries + informational intent 키워드 흡수.

**영역 분리**: P4 = 결과 페이지 안의 *시각 큐레이션 슬롯*. ADR-0051 = SEO
색인 대상 *콘텐츠 라우트*. 두 트랙은 *독립* — 영역 충돌 0.

**단** Q3 = 양방향 cross-ref 가능 (가이드 본문 안에서 picks 카드 임베드
가능, picks rationale 을 가이드 페이지로 링크 가능) = ADR-0051 흡수
(P4 인프라 본 ADR 안에 일괄) vs 별 ADR-0052 신설 결정만 운영자 잠금
대기.

### C5. 운영 제약

- 운영자 €300/월 cap + 솔로 사이드 (ADR-0004 §결정 2 / Amendment 1).
- 3 locale (nl/fr/en) — ADR-0033 Amendment 6 (5→3 통합).
- DeepL Free 500K 자/월 cap (ADR-0033 §T3 + ADR-0040 §T3 hybrid 절차).
- ADR-0034 §D2 = **통신 BE 만 깊게** — 본 ADR 콘텐츠 토픽 정합 잠금.
- ADR-0050 P4 Pieter's picks Q2=A DB `curated_pick` 잠금 (트리거 보류 —
  본 ADR Q3 흡수 여부 결정).
- 헌법 §3 P1 (정보 우선 source/fetched_at) + §3 P2 (5분 5단계 + LCP 2.5s)
  + §3 P3 (투명성 운영자의 짐) + §8 #2 (가격 가공 0) + §8 #3 (다크패턴
  0) + §8 #4 (광고-비교 분리).

### C6. 외부 사실 (벤치마크)

- **NerdWallet (US)** — 비교 도구 + 가이드 글 ~10,000건 (informational +
  비교 의도). 도메인 권위 = 백링크 4M+ (Ahrefs 추정).
- **Check24 (DE)** — 비교 도구 + 가이드 ~3,000건. 도메인 권위 = 백링크
  900K+ (Ahrefs 추정).
- **Google 권위 cold-start 패턴** — 신규 도메인 평균 6~12개월 후 첫
  organic 트래픽 발생 (Ahrefs 2024 study, 신규 도메인 95% 가 1년 내
  10 visits/month 미만).

---

## 결정 (Decision)

> 본 ADR 은 **D1~D4 4 결정 잠금** + **Q1~Q4 운영자 잠금 대기** 구조.
> Q 잠금 후 빌드 분할 P1 진입 가능.

### D1. 콘텐츠 형식 = MDX 우선 (RSC native, 신규 dep 0)

세 옵션 평가:

| 옵션 | 사이즈 | dep | 운영자 편집 UX |
|---|---|---|---|
| **A. MDX** ⭐ | 1d | `@next/mdx` (Next 15 native) | `.mdx` 파일 = Markdown + JSX |
| B. RSC inline | 0.5d | 0 | TSX 코드 작성 필수 (운영자 학습 부담 ↑) |
| C. CMS (Sanity/Contentful) | 5d+ | 외부 SaaS + €20/mo+ | UI 편집 (운영자 €300 cap 위반 위험) |

architect 권고 = **A. MDX** (Next.js 15 RSC 안에 native, 운영자
Markdown 편집 가능, 신규 SaaS 0, €300 cap 위반 0). `@next/mdx` 패키지
1개 추가 — DeepL hybrid (ADR-0040 §T3) 패턴 그대로 적용 가능 (`.mdx`
파일에서 본문 → `scripts/i18n/translate.mjs` 확장).

### D2. 콘텐츠 토픽 후보 8건 (베네룩스 통신 BE informational intent)

| # | 토픽 (한국어 키워드) | 검색 의도 | 운영자 트랙 |
|---|---|---|---|
| 1 | Proximus vs Telenet vs Orange Belgium 2026 비교 | 비교 의도 (head term) | nl/fr/en 본문 |
| 2 | 벨기에 모바일 요금제 평균 가격 가이드 | informational (price benchmark) | nl/fr/en 본문 |
| 3 | Mobile + Internet + TV 트리플 플레이 vs 단품 비용 분석 | informational (bundle math) | nl/fr/en 본문 |
| 4 | 벨기에 ISP 약정 vs 무약정 — 어떤 게 싸나 | informational (contract math) | nl/fr/en 본문 |
| 5 | Telenet vs Proximus 인터넷 속도 / 약정 차이 | 비교 의도 (long-tail) | nl/fr/en 본문 |
| 6 | Orange Belgium Love Duo 검토 — Mobile + Internet 베스트 듀얼 | 제품 검토 | nl/fr/en 본문 |
| 7 | 벨기에에서 가장 싼 100Mbps 인터넷 | "best/cheapest" 의도 (head term) | nl/fr/en 본문 |
| 8 | Mobile Vikings, Voo 등 제외 공급사 정직 표시 (ADR-0011 §T2 + ADR-0029 §T2 정합) | 투명성 (헌법 P3) | nl/fr/en 본문 |

**운영자 본문 작성 트랙 잠금** (CLAUDE.md §9 — 한국어 본문은 운영자
검증 언어, 공개 SEO 본문은 nl/fr/en — Claude 가이드 *틀* 만 제공, 본문
= 운영자 직접 작성). i18n 키만 추가하고 본문 미작성 = ❌ (ADR-0033 §T5
S2 키화만 + 본문 부재 = 콘텐츠 SEO 가치 0).

Q2 = 운영자가 8 후보 중 5~10건 우선순위 잠금 대기.

### D3. URL 구조 = 3 옵션 (Q1 운영자 잠금 대기)

| 옵션 | URL | 장점 | 단점 |
|---|---|---|---|
| **A. `/guides/{slug}`** ⭐ | `/guides/proximus-vs-telenet` | "가이드" 의도 명확 + 영역 분리 + Check24 패턴 | 새 라우트 1개 |
| B. `/blog/{slug}` | `/blog/proximus-vs-telenet` | NerdWallet 패턴 | "블로그" = 일기/뉴스 의도 — 비교 가이드와 톤 차이 |
| C. `/{category}/{slug}` | `/mobile/proximus-vs-telenet` | 카테고리 SEO 깊이 ↑ | `/compare/{category}` 와 충돌 위험 (네임스페이스 모호) |

architect 권고 = **A. `/guides/{slug}`** — 영역 분리 명확 + Check24
정합. sitemap 자동 통합 (`INDEXABLE_PATHS` 배열에 `/guides/{slug}` 추가
+ alternates.languages 5 locale × N entries 자동 생성 — `src/app/sitemap.ts`
회귀 0).

Q1 = 운영자 잠금 대기.

### D4. 콘텐츠 큐레이션 + Pieter's picks 통합 (Q3 운영자 잠금 대기)

ADR-0050 §빌드 분할 P4 (Pieter's picks 큐레이션 인프라, Q2=A DB
`curated_pick`) 와 본 ADR 의 관계:

| 옵션 | 의미 | 사이즈 |
|---|---|---|
| **(가) 본 ADR-0051 흡수** | 본 ADR 이 P4 인프라 (DB `curated_pick`) 도 잠금. 가이드 본문 안에서 picks 카드 임베드 + `/r/[shortId]` 결과 페이지 큐레이션 슬롯도 동일 DB 소비. | +2d (Q2=A DB 신설 본 ADR 흡수) |
| (나) 별 ADR-0052 신설 | 본 ADR 은 콘텐츠 트랙만, ADR-0050 P4 = 별 ADR-0052 트리거. 양방향 cross-ref 만 본 ADR 에 명시. | 0d (영역 분리 유지) |

architect 권고 = **(나) 별 ADR-0052 신설** — 본 ADR 사이즈 cap 보존
(콘텐츠 트랙 단독). ADR-0050 P4 = 베타 트래픽 신호 후 별 ADR-0052
트리거 (현 잠금 보류 정합).

Q3 = 운영자 잠금 대기.

---

## 결과 (Consequences)

### ✅ 회복

- **Google 권위 신호 ↑** — 콘텐츠 깊이 (가이드 5~10건) + 내부 링크
  (가이드 ↔ `/compare/{category}` 양방향) + 베네룩스 키워드 노출 확장
  → 색인 50% 누락 해소 예상 (3~6개월 추적).
- **베네룩스 의도 키워드 impressions ↑** — "vergelijk telecom" 류
  키워드 노출 0 → 5~50 impressions/일 예상 (3개월 후, NerdWallet
  cold-start 비교 추정).
- **헌법 P1 정보 우선 정합 강화** — 가이드 본문 = 정보 + 비교의 하이브리드.
  비교 도구 단독 → 정보 + 비교 (NerdWallet 모델 일부 흡수).
- **헌법 P3 투명성 ↑** — 토픽 8 (제외 공급사 정직 표시 가이드) = ADR-0011
  §T2 + ADR-0029 §T2 정직성 토큰 동형. "Mobile Vikings 는 비교 제외 —
  사유" 가이드는 운영자 신조 직접 표현.
- **운영자 SEO 직접 트랙 정합** (ADR-0034 §D5 운영자 SEO 직접) — 본
  ADR 은 SEO 트랙의 *구체화*, 운영자 본문 작성 트랙 보존.

### ⚠️ 잃는 것 / 부채

- **운영자 콘텐츠 작성 시간 ↑** — 가이드 5~10건 × 평균 4시간 (본문 +
  검수 + 자체 검증) = **20~40 시간**. 운영자 €300/월 cap 의 *시간 예산*
  만 (€0 외화). 솔로 사이드 주 8~20시간 (FOUNDER.md) = 1~5주 부담.
- **DeepL hybrid 비용 ↑** — 콘텐츠 평균 5,000 chars × 3 locale × 5~10
  건 ≈ **75,000~150,000 chars / DeepL Free 500K cap = 15~30% 소비**.
  legal namespace 누적 ~20,400 chars (ADR-0040 §T3) 와 합산 시 ≈ 20~32%
  → Free 티어 유지 (영향 < 50%). 1라운드 안에 발행 불가 (시간 분산 필요).
- **새 라우트 = sitemap entries ↑** — 현재 8 → 13~18 entries (가이드
  5~10 × 1 entry 추가, alternates.languages 3 locale 자동). 새 라우트
  유지 부담 ↑ (ADR-0033 Amd 6 5→3 locale 통합 후 다시 증가).
- **Q2 (P4 Pieter's picks 큐레이션 인프라) cross-ref 잠금 필요** —
  본 ADR D4=(나) 잠금 시 ADR-0052 별 신설 트리거.
- **콘텐츠 부패 위험** — 가이드 본문이 가격/약정 데이터를 *하드코딩* 하면
  실 데이터 (fetcher) 와 시간 흐름 동기화 깨짐 → 헌법 P1 위반 위험.
  봉합 = 가이드 본문은 *방법론/원칙* 중심 + 구체 가격 = `<TariffSnapshot>`
  서버 컴포넌트로 실 DB 조회 (구현 명세 = P1 builder).

### 🔴 운영자 트랙 100%

- **콘텐츠 본문 작성** = 운영자 직접 (CLAUDE.md §9 + ADR-0034 §D5 정합).
  Claude 는 (1) MDX 인프라 (2) i18n 키 (3) DeepL hybrid 라운드 (4)
  sitemap 정합 자동 처리. 본문 = 운영자 nl/fr/en 직접 작성 (한국어
  본문은 운영자 검증 트랙).
- **백링크 채널** = 운영자 직접 (베네룩스 포럼 / Reddit r/belgium /
  가격비교 디렉토리 등록 / Wikipedia 인용 등). 본 ADR 범위 밖 (운영자
  옵션 C 트랙 정합).

---

## 미결 (운영자 잠금 대기)

### Q1. URL 구조 — D3 옵션

- (a) `/guides/{slug}` ⭐ architect 권고
- (b) `/blog/{slug}`
- (c) `/{category}/{slug}` (예: `/mobile/proximus-vs-telenet`)

### Q2. 콘텐츠 토픽 5~10건 잠금 우선 순위 — D2 후보 8개 중

- 운영자가 8 후보 중 우선 5~10건 선택 + 본문 작성 순서 잠금.
- 권고 = (1) Proximus vs Telenet vs Orange BE 비교 (head term, 최대
  impressions 기대) → (2) 벨기에 모바일 평균 가격 가이드 (informational
  head term) → (8) 제외 공급사 정직 표시 (헌법 P3 차별화) 순.

### Q3. P4 Pieter's picks 큐레이션 통합 여부 — D4

- (가) 본 ADR-0051 흡수 (DB `curated_pick` 인프라 본 ADR 안에)
- (나) 별 ADR-0052 신설 (영역 분리, 본 ADR 사이즈 cap 보존) ⭐ architect 권고

### Q4. 빌드 분할 옵션 — §빌드 분할 참조

- (A) P1+P2 만 (1 가이드 발행 후 효과 측정 — 3개월 SC 추적 후 추가
  결정) — *최소 회복 사이즈*.
- (B) P1~P5 풀 트랙 (5~10 가이드 + 외부 채널 등록까지) — *최대 회복*.

architect 권고 = **A (P1+P2 만)** — 운영자 시간 cap + SC 데이터 게이트
정합 (1 가이드 발행 → 3개월 SC 추적 → 효과 신호 후 P3~P5 진입).

---

## 빌드 분할 (Build Phases)

> Q1~Q4 잠금 후 P1 진입.

| # | 트랙 | 사이즈 | 의존 | 결정 cross-ref |
|---|---|---|---|---|
| **P1** | MDX 인프라 + 첫 가이드 1건 (운영자 본문) | 2d Claude + 운영자 본문 | (없음) | D1, D2 #1 또는 #2 |
| **P2** | i18n 3 locale 봉합 + DeepL hybrid 라운드 | 1d | P1 | ADR-0040 §T3 |
| **P3** | sitemap + hreflang 정합 | 0.5d (자동) | P2 | `src/app/sitemap.ts` 회귀 0 |
| **P4** | 가이드 추가 4~9건 (운영자 본문 시간 분산) | 운영자 시간 | P3 | D2 |
| **P5** | 외부 디렉토리 등록 + 베네룩스 포럼 (운영자 직접) | 운영자 시간 | (병렬) | C3 옵션 C 동형 |

### P1 진입 게이트 (Q 잠금 후)

1. `@next/mdx` 패키지 추가 + `next.config.ts` MDX 플러그인 셋업.
2. `/guides/{slug}` 라우트 (또는 Q1 잠금값) RSC 신설.
3. 첫 가이드 1건 (Q2 잠금 #1) MDX 파일 신설 (`src/content/guides/{slug}.mdx`).
4. `messages/{nl,fr,en}.json` 가이드 메타데이터 키 (title / description /
   ogImage) 추가.
5. `src/app/sitemap.ts` `INDEXABLE_PATHS` 배열에 `/guides/{slug}` 추가.

---

## 검증 (Verification)

### V1. i18n 정합

- `pnpm harness:i18n` GREEN 유지 (콘텐츠 본문 i18n 정합, ADR-0036 §D2).

### V2. PLAN 정합

- `pnpm harness:plan` 정합 — 페이즈 4.22 (또는 운영자 잠금 페이즈) 신설
  시 합계 갱신.

### V3. LCP 회귀 0

- Lighthouse LCP ≤ 2.5s 유지 (ADR-0023 §T4). MDX 정적 생성 = ISR/RSC
  native = LCP 영향 최소 추정.

### V4. SC impressions 추적 게이트 (운영자 트랙)

- 30일 / 90일 / 180일 누적 impressions 추적 (운영자 SC 회고, ADR-0046
  §D1 동형 = 시간 + 인간 판단 의존).
- 트리거: 90일 시점 impressions ≥ 50/일 = 효과 신호 GREEN → P4 진입.
  impressions < 10/일 = 효과 신호 RED → architect 재호출 (toptic
  재평가 + 백링크 채널 옵션 C 트리거).

### V5. bias-audit 정합 (ADR-0026 §T4)

- 콘텐츠 가이드 안 비교 추천 = 큐레이션 편향 추적 대상 (ADR-0050 §V4
  동형). `pnpm harness:bias` 월요일 06:00 UTC 정합.

### V6. 콘텐츠 신선도 (P1 위반 방지)

- 가이드 본문 안 가격/약정 데이터 = 하드코딩 ❌ (P1 위반 위험).
  서버 컴포넌트로 실 DB 조회 (구체 구현 명세 = P1 builder 진입 시
  결정).

---

## 대안 (Alternatives)

### Alt A. 시간 대기 (옵션 A, 3~6개월 추가) — 거부

- ADR-0034 §D5 정합 — 본 ADR 신설 없이 organic SEO 시간 대기.
- 거부 사유 = 운영자 직접 선택 옵션 B + 콘텐츠 0 상태에서 시간 대기 =
  Google 권위 cold-start 패턴 (Ahrefs 2024) 그대로 잔존 — *콘텐츠
  깊이 부재가 권위 부재의 근본 원인* 이라 시간 단독으로 회복 불가.

### Alt B. 백링크 채널 단독 (옵션 C) — 보류

- 외부 채널 (Reddit / Wikipedia / 디렉토리) 등록 = Google 권위 직접 신호.
- 거부 사유 = 콘텐츠 깊이 0 상태에서 백링크만 = 외부 채널 "Slim 이 뭐?"
  질문에 답할 콘텐츠 부재 = 백링크 효과 ↓. 본 ADR P5 (외부 채널 등록) =
  P1~P4 콘텐츠 발행 후 진입 정합 (시퀀스 잠금).

### Alt C. 유료 채널 (Google Ads, 옵션 D) — 결정적 거부

- ADR-0034 §결정 5 + 헌법 §8 #4 (광고 영역과 비교 영역 분리) 정면 위반.
- 거부 사유 = 운영자 €300/월 cap 의 *유료 채널 0 신조* + 헌법 위반.

### Alt D. 베타 모집 직접 (옵션 E) — 보류

- ADR-0029 deprecate (ADR-0034 §D5) 정합 — 본 ADR 범위 밖.
- 보류 사유 = 운영자 별 트랙 (콘텐츠 트랙과 직교).

### Alt E. CMS (Sanity / Contentful) — 거부

- D1 옵션 C 거부 사유 동형 = 외부 SaaS €20/mo+ + 운영자 €300 cap 위반
  위험 + Next.js native dep 0 (MDX) 으로 동일 UX 가능.

---

## 관련 ADR Cross-ref

- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) §T2 0 데이터
  정직 토큰 — 본 ADR D2 토픽 8 (제외 공급사 정직 표시 가이드) 동형.
- [ADR-0026](0026-affiliate-click-and-attribution.md) §T4 bias-audit —
  본 ADR §V5 콘텐츠 가이드 안 추천 편향 추적 정합.
- [ADR-0029](0029-beta-recruitment.md) §T2 정직성 토큰 (deprecated) —
  본 ADR D2 토픽 8 동형 (이력 보존 가치).
- [ADR-0033](0033-i18n-next-intl-introduction.md) §T2 3 locale (nl/fr/en,
  Amd 6) + §T5 S2 컴포넌트 t() 소비 — 본 ADR §C5 + P2 정합.
- [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) §D2
  통신 BE 만 + §D5 organic SEO + 운영자 SEO 직접 — 본 ADR 이 §D5 의
  *구체화* (D5 본문 변경 0, cross-ref 1줄만).
- [ADR-0040](0040-legal-namespace-deepl-hybrid-and-interstitial-boundary.md)
  §T3 DeepL hybrid — 본 ADR P2 i18n 본문 절차 동형 적용.
- [ADR-0046](0046-phase-4-closure.md) §D1 시간 트랙 + §D2 "운영자 트랙
  분리 명시" — 본 ADR §V4 운영자 회고 트리거 + §결과 운영자 트랙 분리
  명시 정합 (ADR-0048 본문 부재 자가 검증 결과로 ADR-0046 §D2 로 단일
  인용 봉합 — architect 2026-06-24 자가 검증).
- [ADR-0050](0050-ui-v2-comparison-redesign.md) §빌드 분할 P4 Pieter's
  picks + Q2=A DB `curated_pick` — 본 ADR §C4 영역 충돌 정찰 결과 +
  Q3 통합 여부 결정 대기.
- 헌법 §3 P1 / P2 / P3 + §8 #2 / #3 / #4.

---

## 외부 사실

- [Ahrefs — How Long Does It Take to Rank in Google? (2024 study)](https://ahrefs.com/blog/how-long-does-it-take-to-rank/)
  — 신규 도메인 평균 6~12개월 cold-start 패턴 (architect 본문 §C2 + §C6
  인용, 운영자 승인 시 WebFetch 검증 권장).
- [Next.js — MDX](https://nextjs.org/docs/app/building-your-application/configuring/mdx)
  — `@next/mdx` Next 15 native, RSC 호환 (본 ADR D1 옵션 A 권고 근거).
- ADR-0034 §D5 §정합 확인 — Google Search Console PII 0 (본 ADR §C1
  SC 데이터 회고 정합).
- Google Search Console 데이터 (slim.lu, sc-domain, 26.6.2 ~ 26.6.22) —
  본 ADR §C1 운영자 직접 회고 수치 (외부 검증 가능, 운영자 SC 계정 SoT).

---

## 다음 단계 (Next Steps)

1. **운영자 잠금 게이트** — §미결 Q1 (URL 구조) + Q2 (토픽 5~10건 우선
   순위) + Q3 (P4 Pieter's picks 통합 여부) + Q4 (빌드 분할 옵션) 잠금.
2. Q1~Q4 잠금 시 → §빌드 분할 P1 진입 게이트 열림 (사이즈 2d Claude +
   운영자 본문 1건).
3. Q3 = (나) 별 ADR-0052 신설 잠금 시 → ADR-0050 §빌드 분할 P4 트리거
   시점 (베타 트래픽 신호 후) 에 별 ADR-0052 architect 호출.
4. PLAN 갱신 위치 (Q1~Q4 잠금 후) = 페이즈 4.22 (UI v2 sweep 4.19~4.21
   직후) 또는 페이즈 4.5.4 (운영 평가 트랙) — 운영자 잠금 대기.
5. P1 builder 진입 명세 (architect → builder 인계, Q 잠금 후 별 턴):
   - 파일: `next.config.ts` (MDX 플러그인) + `src/app/[locale]/guides/[slug]/page.tsx`
     (또는 Q1 잠금값) + `src/content/guides/{slug}.mdx` (운영자 본문) +
     `messages/{nl,fr,en}.json` (가이드 메타데이터 키) + `src/app/sitemap.ts`
     `INDEXABLE_PATHS` 배열 1줄.
   - 의존: `@next/mdx` (신규 dep 1, Next 15 native).
   - 테스트: 가이드 라우트 렌더 + sitemap entry 회귀 + LCP 회귀 (Lighthouse).

---

## Amendment 1 (2026-07-08) — §D1 MDX → TSX 정적 라우트 이전

**상태**: **Accepted (2026-07-08, 운영자 잠금 — Option 2 트리거 확정).**

> 원 §D1 (MDX 인프라 우선) 결정은 폐기하지 않고 **역사적 기록으로
> 유지** (헌법 §3 P3 정직성 정합). 본 Amendment 는 §D1 결정 위에 새
> 결정 레이어를 얹어 재정의한다.

### A1.C. 컨텍스트 (Context)

원 §D1 (@next/mdx 통합 + `[locale]/[slug]` dynamic route + MDX 파일
`src/content/guides/*.mdx`) 잠금 후 4.22 P1 (PR #70) 머지, 이후
prod slim.lu/{locale}/guides/{slug} 4 locale (nl/fr/en/default)
전체에서 **404 반환** 회귀 발견 (2026-06-29 운영자 SC URL 검사
결과).

두 hotfix 시도, 모두 실패:

**PR #72** — 정적 import map + MDX ambient .d.ts:
- `src/app/[locale]/guides/[slug]/page.tsx`:
  `` await import(`@/content/guides/${slug}.mdx`) `` template literal
  → 정적 map (`GUIDE_MODULES`) + slug lookup 전환.
- `src/types/mdx.d.ts` 신설 (ambient `declare module '*.mdx'`).
- `src/lib/guides.ts`: CRLF 안전 정규식 (Windows 부수 봉합).
- **결과**: prod 여전히 404, X-Vercel-Cache HIT.

**PR #73** — outputFileTracingIncludes + force-static 제거:
- `next.config.ts`: `outputFileTracingIncludes` 추가
  (`/[locale]/guides/[slug]` → `./src/content/guides/**/*`).
- `src/app/[locale]/guides/[slug]/page.tsx`: `dynamic = 'force-static'`
  제거 → fallback ISR.
- **결과**: prod 여전히 404, 9일 후에도 동일.

**진단 (architect)**:
- Next.js 15 + Turbopack + `[locale]/[slug]` dynamic route + MDX RSC
  조합이 Vercel prod 에서 작동 X.
- 정확한 근본 원인 미확정 — 심층 진단 = Vercel build log (Chrome MCP
  + 운영자 Vercel 인증) 필요, 4시간+ 소요, 3번째 hotfix 성공 보장 X.
- 시간 투자 대비 ROI 낮음 (P1 가이드 5~10건 계획이라 MDX 자유도
  필수 아님, TSX 로 감당 가능).

### A1.O. 운영자 4 옵션 잠금 (2026-07-08)

| 옵션 | 의미 | 판정 |
|---|---|---|
| 1 | 심층 진단 + 3번째 hotfix (Vercel build log 정찰) | 거부 — 4시간+ + 3번째 실패 위험 |
| **2** ⭐ | **MDX 폐기 → TSX 정적 라우트** | **운영자 선택** |
| 3 | 3rd party MDX (contentlayer / velite) | 거부 — 신규 dep = §D1 잠금 (dep 0) 위반 |
| 4 | ADR-0051 트랙 자체 보류 / Rejected | 거부 — 옵션 B 콘텐츠 마케팅 트랙 이유 유지 |

운영자 Option 2 선택 이유:
1. 9일 두 번 실패 = MDX 트랙 계속 밀면 시간 낭비 위험 高.
2. 가이드 5~10건 = TSX 감당 가능 (MDX 자유도 필수 아님).
3. **prod 안정성 확실** — Next.js 정적 라우트 패턴 = 검증된 인프라.
4. 콘텐츠 시각화 자유도 향상 (TSX = React 컴포넌트 = 표/차트/interactive).
5. 운영자 학습자 모드 정합 (feedback_learning_mode 메모리, TSX 학습
   유익).

### A1.D. 결정 (Decision)

- 원 §D1 (@next/mdx 통합 + `[locale]/[slug]` dynamic route + MDX
  파일 `src/content/guides/*.mdx`) **폐기**.
- 각 가이드 = **정적 TSX 라우트 하나씩** — 예:
  `src/app/[locale]/guides/proximus-vs-telenet-vs-orange-be/page.tsx`.
- 본문 = TSX 컴포넌트 (JSX + Tailwind + next-intl `t()` — 필요 시).
- **Q1 = (a) `/guides/{slug}` URL 구조 유지** — 사용자 URL 안정성
  (이미 PR #70 발행 후 SC 색인 요청된 URL 유지).
- ADR-0050 §D6 다크패턴 회피 잠금 정합 유지.

### A1.R. 변경 범위 (Scope)

**삭제**:
- `@next/mdx` dep (package.json).
- `pageExtensions: ['mdx']` (next.config.ts).
- `outputFileTracingIncludes` (next.config.ts, PR #73 잔재).
- `src/app/[locale]/guides/[slug]/page.tsx` (dynamic route).
- `src/lib/guides.ts` + `src/lib/guides.test.ts`.
- `src/types/mdx.d.ts` (PR #72 잔재).
- `src/content/guides/*.mdx` (모든 MDX 파일).

**수정**:
- `next.config.ts` — MDX 통합 제거.
- `src/app/sitemap.ts` — 정적 슬러그 배열 소비 (fs.readdir 자동
  추출 X).
- `src/app/[locale]/guides/page.tsx` — 정적 가이드 배열 소비
  (index 페이지, 가이드 0건이면 ADR-0011 §T2 정직 표시 = "가이드
  준비 중").

**신설**:
- `src/app/[locale]/guides/proximus-vs-telenet-vs-orange-be/page.tsx`
  — RSC + `generateMetadata` (인라인 title/description) + hreflang
  3 locale + 본문 placeholder (운영자 본문 트랙).

### A1.Q. 기존 Q 잠금 유지

- **Q1 유지 = (a) `/guides/{slug}` URL 구조** — Amendment 1 재잠금.
- **Q2 유지 = 원 권고 순서** — 첫 가이드 = Proximus vs Telenet vs
  Orange BE (head term), 후속 = 벨기에 모바일 평균 가격 → 제외
  공급사 정직 표시.
- **Q3 유지 = (나) 별 ADR-0052 신설** — P4 Pieter's picks 큐레이션
  = 별 ADR (본 ADR 사이즈 cap 보존, 영역 분리).
- **Q4 유지 = (A) P1+P2 만 잠금** — 1 가이드 발행 → 3개월 SC 추적
  → 효과 신호 후 P3~P5 진입.

### A1.D3'. §D3 (콘텐츠 자동 추출) 재정의

- 원 §D3: `getGuideEntries()` `fs.readdir` 로 자동 추출 (MDX 파일
  기반).
- 새 §D3: 각 가이드 = TSX 라우트 하나 = **명시적 코드 등록**. 자동
  추출 X, 운영자 트랙 명시 (헌법 §3 P3 정직성 정합 — 자동 매직 X).

### A1.D4'. §D4 정직성 정합

- `/guides` 인덱스 페이지 = 정적 배열 소비 (가이드 목록 하드코드,
  새 가이드 추가 시 배열 갱신).
- ADR-0011 §T2 동형 — 가이드 0건일 때 "가이드 준비 중" 정직 표시
  (원 §결과 P3 투명성 잠금 유지).

### A1.B. 빌드 분할 유지 (Q4 P1+P2 잠금)

- **P1 (PLAN 4.22 재정의)**: TSX 정적 라우트 신설 + 첫 가이드
  스켈레톤 (Claude 인프라, 운영자 본문 트랙). 폐기 파일 명시 삭제
  (Amendment 1 hotfix #3 PR).
- **P2 (PLAN 4.23 재정의)**: i18n 4 locale 봉합 + DeepL hybrid
  (운영자 영어 본문 → nl/fr 자동 번역, ADR-0040 §T3 절차 정합).

### A1.V. 검증 (Verification)

- **V1**. `pnpm harness:i18n` GREEN 유지.
- **V2**. `pnpm harness:plan` 정합 (PLAN 4.22/4.23 Amendment 1
  재정의 반영).
- **V3**. Lighthouse LCP ≤ 2.5s 유지 — **정적 페이지 = 이상적**
  (ISR 오버헤드 X).
- **V4**. **Vercel prod 200 OK 실측** — slim.lu/guides/{slug} +
  slim.lu/{en,nl,fr}/guides/{slug} = **4/4 URL 200 OK**. 이 게이트가
  Amendment 1 성공 판정의 SoT (PR #72 + #73 회귀 재발 방지 잠금).
- **V5**. Google Search Console URL 검사 → 색인 요청 성공 (운영자
  트랙, V4 통과 후).

### A1.C+. Consequences

**✅ 회복**:
- Vercel prod 안정성 100% (정적 페이지 = 검증된 패턴).
- LCP 정적 = 이상적 (ISR 오버헤드 X, ADR-0023 §T4 정합).
- 콘텐츠 자유도 ↑ (TSX = React 컴포넌트 = 표/차트/interactive
  가능).
- 학습자 모드 정합 (TSX 학습 유익, feedback_learning_mode 메모리).

**⚠️ 잃는 것 / 부채**:
- 마크다운 문법 편의성 손실 — 5~10 가이드는 감당 가능 범위.
- 새 가이드 추가 시 페이지 파일 신설 (자동 추출 X) — 운영자 트랙
  명시 (§A1.D3' 정합).
- 원 PR #70 + PR #72 + PR #73 = **폐기 트랙** = 코드 삭제 트랙
  (Amendment 1 hotfix #3 PR 이 명시 삭제 + 본 Amendment 본문 명시
  링크).

### A1.X. 폐기 코드 잔재 청소

- Amendment 1 P1 hotfix #3 PR 이 §A1.R "삭제" 목록 파일 명시 삭제
  + PR description 에 본 Amendment 링크 명시.
- 삭제 PR 머지 시 원 §D1 MDX 인프라 트랙 = 완전 폐기 확정.

### A1.CR. Related Cross-ref

- ADR-0034 §D5 organic SEO 런치 — 본 Amendment 정합 유지 (§D5
  본문 변경 0).
- ADR-0050 §D6 다크패턴 회피 잠금 — TSX 라우트에도 잠금 유지.
- ADR-0033 Amd 6 3 locale (nl/fr/en) — TSX 라우트 hreflang 정합
  (default locale 포함 4 URL 검증).
- ADR-0023 §T4 LCP — **정적 페이지 = 이상적** (Amendment 1 회복
  포인트).
- ADR-0011 §T2 + ADR-0029 §T2 정직성 — 가이드 0건 정직 표시
  (§A1.D4' 정합).
- ADR-0040 §T3 DeepL hybrid — P2 (PLAN 4.23) i18n 본문 절차 정합
  유지.

### A1.N. 다음 단계 (Next Steps)

1. Amendment 1 Accepted 마킹 확정 (본 문서 상단 §상태 갱신 시점 =
   운영자 결정 트리거 확정).
2. **builder 트리거** (병렬 진행 가능 — 본 Amendment 결정 명확):
   - 브랜치: `hotfix/adr-0051-amd1-mdx-to-tsx` (또는 운영자
     명명값).
   - PR: §A1.R "삭제" 파일 명시 삭제 + §A1.R "수정" 파일 재작성 +
     §A1.R "신설" 파일 (첫 가이드 TSX 스켈레톤).
   - PR description: 본 Amendment 링크 + V4 게이트 (prod 4/4 URL
     200 OK) 명시.
3. PLAN 4.22 (P1) + 4.23 (P2) Amendment 1 재정의 반영 (별 architect
   턴 or builder 인계 시 동반 갱신).
4. builder 머지 후 운영자 V5 (SC URL 검사 → 색인 요청) 트랙 진입.
