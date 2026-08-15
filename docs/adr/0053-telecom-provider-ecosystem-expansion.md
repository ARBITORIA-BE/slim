# ADR-0053: 통신 공급사 생태계 확장 — 6하원칙 편입 심사 프레임 + 정찰 라운드

## 상태

**Proposed** (2026-08-15, Pieter — 운영자 니즈 진단 트리거). **운영자 Q1~Q3 잠금 후 Accepted.**

> 선행 완료: 제외 공급사 10건 시드 (PR #84, `1e222a5`) — 본 ADR 의 0단계에 해당.

## 맥락 (Context)

### 트리거 — "무엇을" 축의 커버리지 약점

운영자 진단 (2026-08-15): *"내가 아는 통신사면 5개가 넘는데 지금 두개, 그리고 오렌지도 한정적으로만 비교 서비스를 하고 있다."*

정확한 지적이었고, 실측 결과 **표면적 숫자보다 나빴다.**

### 실측 커버리지 매트릭스 (2026-08-15)

| 카테고리 | Proximus | Telenet | Orange BE |
|---|---|---|---|
| `mobile` | ✅ | ✅ | ❌ (PLAN 4.24 대기) |
| `internet_fixed` | ✅ | ❌ (manual 폴백) | ✅ |
| `bundle_mobile_internet` | ❌ | ❌ | ❌ |
| `bundle_internet_tv` | ❌ | ❌ | ❌ |
| `bundle_mobile_internet_tv` | ❌ | ❌ | ❌ |

출처: `src/fetchers/proximus.ts` / `telenet.ts` / `orange-be.ts` 의 `categories` 필드.

**5 카테고리 × 3 공급사 = 15칸 중 자동 수집 4칸 (27%).**

특히 [ADR-0042](0042-telecom-bundle-taxonomy-extension.md) 로 번들 카테고리를 3종 신설했으나 **번들 fetcher 는 0개**다. 카테고리 enum 은 존재하고 데이터가 없다 — 사용자가 번들을 고르면 비교 대상이 비어 있다.

### 제외 목록 공백 (PR #84 로 봉합됨)

`scripts/seed-providers.ts` 가 비교 대상 3사만 시드하고 `excludedReason` 행을 하나도 넣지 않아, `/data-sources` 제외 섹션이 **비어 있었다.** 동시에 [가이드 §3](../../src/app/[locale]/guides/proximus-vs-telenet-vs-orange-be/page.tsx) 이 *"see the full exclusion list on /data-sources"* 라고 라이브 안내 중 = 헌법 §3 **P3** 위반.

PR #84 로 10건 시드 완료 (Mobile Vikings · Scarlet · BASE · Edpnet · Lycamobile · JIM Mobile · hey! · Digi Belgium · Lebara · VOO). **단 그중 8건의 사유가 "아직 조사하지 않았다"** — 본 ADR 이 그 조사를 정의한다.

### 운영 제약

- 공급사 1개 fetcher ≈ **1~2일** (PLAN 4.24 Orange mobile 추정치 기준) → 10개 = 비현실적. **우선순위 산정이 본 ADR 의 핵심 산출물**이다.
- [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D2 "통신 BE 한정" 은 **유지**된다. 본 ADR 은 카테고리 확장이 아니라 **같은 카테고리 안의 공급사 확장**이다.
- 공급사마다 GTC / robots 법적 검토 선행 필수 ([ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) Appendix B 절차).
- 운영자 €300/월 cap — 신규 SaaS 비용 0 이어야 한다.

## 결정 (Decision)

### D1. 6하원칙 편입 심사표 — 공급사 1건당 6축 판정

운영자 프레임 채택: **"니즈는 6하원칙으로 답할 때 문제 해결력이 가장 높다."** 이를 *편입 심사 기준*으로 전환한다.

| 축 | 심사 질문 | 판정 근거 |
|---|---|---|
| **누가** | MNO(자체망)인가 MVNO(임대망)인가? 어떤 층을 겨냥한 브랜드인가? | 공식 사이트 + KBO/BCE 법인 조회 |
| **어디서** | 커버 지역은? MVNO면 호스트망은 누구인가? | 공식 커버리지 페이지 |
| **무엇을** | 5 카테고리 중 무엇을 파는가? | 공식 요금제 페이지 |
| **언제** | 가격 갱신 주기는? 24h fetch 가 의미 있는가? | 프로모 표기 + 변경 이력 관찰 |
| **어떻게** | 정적 HTML / JS 렌더 / API / WAF 차단 중 무엇인가? | **raw fetch 실측** (WebFetch 아님 — [메모리 `reference_fetcher_recon_method`](../../CLAUDE.md)) |
| **왜** | 편입 사유, 또는 **제외 사유** | 위 5축 종합 |

### D2. 판정 2분기 — "미정" 상태를 만들지 않는다

**6축 중 하나라도 못 채우면 편입 후보에서 빼고 `excludedReason` 을 갱신한다.**

이 규칙의 효과: 정찰 결과가 어느 쪽이든 **산출물이 나온다.**
- 6축 충족 → 편입 후보 (우선순위 산정 대상)
- 미충족 → 제외 + **구체적 사유 공개** (P3 즉시 충족)

현재 8건이 달고 있는 `"Not yet assessed"` 는 본 라운드 후 **전부 구체 사유로 교체**된다. Lebara 의 `"HTTP 403 bot protection"` 이 목표 품질 수준이다 — *"안 봤다"* 가 아니라 *"봤는데 이래서 안 된다"*.

### D3. 정찰 방법론 — 기존 재사용, 신설 0

[ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) Amendment 3 §Decision 2 "페이지 단위 정적 판단" + 1.5.8/1.5.9 에서 확립한 절차를 그대로 쓴다:

1. `undici` raw fetch (WebFetch 는 렌더 결과라 판정 불가)
2. robots.txt 확인
3. GTC 다운로드 → `pdftotext` → `legal` 판정 ([메모리 `reference_gtc_legal_review`](../../CLAUDE.md))
4. 셀렉터 후보 3종 잠금 + 가격 추출 성공 여부

**신규 의존성 0, 신규 SaaS 0.**

### D4. 우선순위 산식 (제안 — Q2 로 운영자 잠금)

```
우선순위 = 시장 도달  ×  수집 난이도의 역수  ×  카테고리 갭 기여도
```

- **시장 도달**: MNO > 대형 MVNO > 소형 MVNO
- **수집 난이도**: 정적 HTML(1.0) > JS 렌더(0.3) > WAF 차단(0.0 = 편입 불가)
- **카테고리 갭 기여도**: 번들 커버(높음) > mobile/internet 보강(낮음) — 현재 번들 0칸

### D5. legal 게이트 선행

편입 후보로 판정되어도 **GTC/robots 검토 통과 전에는 fetcher 를 만들지 않는다.** 1.5.8/1.5.9 선례 준수.

## 운영자 결정 영역 (Accepted 전 잠금 필요)

### Q1 — 정찰 범위

| 옵션 | 내용 | 비용 |
|---|---|---|
| (가) 10건 전부 | PR #84 시드 10건 모두 6축 심사 | ~1.5d |
| (나) 상위 N건 | 사전 스크리닝 후 상위 4~5건만 | ~0.7d |
| (다) 실측 기반 자동 축소 | 1차 raw fetch 로 WAF 차단 즉시 탈락 → 잔여만 심층 | ~1.0d |

### Q2 — 우선순위 가중치

§D4 산식을 그대로 쓸지, 세 인자 중 하나에 가중을 둘지.

### Q3 — 순서: 번들 먼저 vs 공급사 먼저

| 옵션 | 근거 |
|---|---|
| (가) **번들 먼저** | 15칸 중 번들 9칸이 전부 0. 베네룩스는 번들 가입이 주류 — 기존 3사 번들만 채워도 커버리지 27% → 60% |
| (나) **공급사 먼저** | 운영자 원 니즈("사업자가 2개뿐")에 직접 답함 |
| (다) 병행 | 사이즈 초과 우려 |

## 결과 (Consequences)

### ✅ 얻는 것

- "무엇을" 축의 커버리지 개선 경로가 **측정 가능한 형태**로 잠긴다 (15칸 중 N칸)
- 제외 사유가 전부 구체화 → P3 품질이 "이름만 공개"에서 "이유까지 공개"로 상승
- 6축 심사표가 **미래 공급사 편입의 재사용 템플릿**이 된다 (NL/LU 진입 시에도)

### ⚠️ 잃는 것 / 부채

- 정찰 자체는 사용자 표면 변화 0 — 커버리지는 후속 fetcher 라운드에서만 는다
- fetcher 가 늘수록 **fetcher 실패율 모니터링 부담 증가** — Inngest 자체 알림 부재 상태 ([runbook](../runbook/inngest-alert-rules.md) §선행 정찰) 와 겹친다
- MVNO 편입 시 "호스트망이 같은데 가격만 다른" 중복 노출 → 비교 UX 복잡도 상승 (별 검토 필요)

### 잠긴 트레이드오프 (재논의 ❌)

- ADR-0034 D2 "통신 BE 한정" 유지 — 본 ADR 은 카테고리 확장이 아니다
- 수동 입력 가격 편입 ❌ — 자동 수집 불가 사업자는 제외 + 사유 공개가 원칙 (Lebara 선례)

## 검증 방법 (Verification)

- **V1**: 심사 대상 전원이 6축 판정표를 갖는다 (미판정 0)
- **V2**: `"Not yet assessed"` 사유가 0건으로 감소 (구체 사유로 전량 교체)
- **V3**: 편입 후보별 예상 공수 + 우선순위 점수 산출 → PLAN 항목 신설 근거
- **V4**: 7단 게이트 GREEN + `/data-sources` prod 실측으로 사유 갱신 확인

## 관련 ADR

- [ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) — fetcher 실 스크래핑 리스크 + Appendix B GTC 절차 (본 ADR 의 방법론 출처)
- [ADR-0034 D2](0034-strategy-pivot-completion-first-seo-launch.md) — 통신 BE 한정 (범위 cap 유지) + Amendment 1 (VOO–Orange 합병)
- [ADR-0042](0042-telecom-bundle-taxonomy-extension.md) — 번들 카테고리 3종 신설 (본 ADR 이 그 데이터 공백을 지적)
- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) — `/data-sources` 제외 공급사 공개 (P3 표면)
- [ADR-0021](0021-phase-3-results-page-design.md) §T6 — 제외 공급사 목록 helper 공유 (`getExcludedProviders`)
