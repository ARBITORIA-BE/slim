# ADR-0053: 통신 공급사 생태계 확장 — 6하원칙 편입 심사 프레임 + 정찰 라운드

## 상태

**Accepted** (2026-08-15, 운영자 — **Q3 = (가) 번들 먼저** 잠금).

- **Q3 잠금 = 번들 먼저.** 15칸 중 번들 9칸이 전부 0 → 기존 3사 번들만 채워도 커버리지 **27% → 60%**. 공급사 확장(§D7)은 후행.
- **Q1 / Q2 는 이연.** Q3 잠금이 두 질문의 대상을 바꾼다 — 정찰 범위·우선순위 가중치는 *신규 공급사* 트랙(§D7)의 질문이고, 번들 트랙은 **대상이 기존 3사로 이미 확정**되어 있다. 4.26.b 진입 시점에 잠근다.

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

### D6. 번들 우선 트랙 (Q3 잠금) — 정찰 실측 완료

**2026-08-15 raw fetch 정찰 결과 (본 ADR §D3 절차 적용, 프로덕션과 동일한 `Slim/1.0` UA).**

| 공급사 | 번들 URL (최종) | 상태 | 길이 | € 문자 | 가격 토큰(고유) | 「어떻게」 판정 |
|---|---|---|---|---|---|---|
| Proximus | `/en/packs` | 200 | 213KB | 79 | 71 (26) | **정적 파싱 가능** |
| Telenet | `/residential/nl/producten/internet-mobiel-tv.html` | 200 | 649KB | 44 | 33 (16) | **정적 파싱 가능** |
| Orange | `/fr/produits-et-services/internet-tv-mobile` | 200 | 157KB | 36 | 33 (17) | **정적 파싱 가능** |

**robots.txt**: Proximus / Telenet = 번들 경로 Disallow **없음**. Orange = Disallow 2건이 있으나 전부 `support/assistance-technique` 도움말 경로 — **상품 페이지 대상 아님**.

#### ⚠️ 정찰 방법론 교훈 — 1차 판정이 틀렸다

1차 스캔에서 Orange 를 **가격 토큰 0건 → "JS 렌더 의심"** 으로 판정했다. 원인은 정규식이 소수점을 필수로 요구한 것(`\d+[.,]\d{2}\s?€`)이었고, Orange 는 `46€` 처럼 **정수 + €** 로 표기한다. 정규식 보정 후 33건이 나왔다.

**1차 판정을 그대로 받았다면 편입 가능한 공급사를 제외로 보냈을 것이다.** §D2 "미정 금지" 규칙은 판정을 강제하지만, **판정 도구 자체의 오탐**은 막지 못한다. 따라서:

> **정찰 규칙 추가**: 「어떻게」 축에서 *부정* 판정(JS 렌더 / 파싱 불가)을 내릴 때는 **최소 2가지 표기 패턴**(정수+€ / €+소수)으로 재확인한 뒤 확정한다. 긍정 판정은 1회로 충분하다 — 오탐 비용이 비대칭이기 때문이다.

#### 판정의 한계 (과대 해석 금지)

가격 문자열이 정적 HTML 에 **존재함**은 확인했으나, 이것이 곧 **요금제 구조 매핑 가능**을 뜻하지는 않는다. 티어명 ↔ 가격 ↔ 프로모 기간의 셀렉터 확정은 builder 게이트 A(첫 fetch 정찰) 소관이다. 본 정찰의 산출은 **"진입해도 되는가"** 이지 **"어떻게 파싱하는가"** 가 아니다.

#### 부수 발견 — Telenet internet

`producten/internet.html` 도 200 + 가격 토큰 36건(고유 17)으로 관측됐다. Telenet internet 은 현재 fetcher `categories` 에서 빠져 **manual 폴백** 상태다(`src/fetchers/telenet.ts:137`). 번들 라운드와 동일 도메인·동일 마크업 계열이므로 **같은 라운드에서 함께 처리하는 것이 효율적**일 수 있다 — 4.26.a 착수 시 builder 판단.

### D6.1 구현 라운드 결과 (2026-08-19, PLAN 4.26.a — 게이트 A/B 통과)

정찰(§D6)이 예고한 "셀렉터 확정" 을 실제 구현으로 마쳤다. **커버리지 15칸 중 4 → 10칸 (27% → 67%).**

| 카테고리 | Proximus | Telenet | Orange BE |
|---|---|---|---|
| `mobile` | ✅ | ✅ | ❌ (JS 렌더 — 4.24 취소) |
| `internet_fixed` | ✅ | ✅ **신규** | ❌ **회귀 — 아래 참조** |
| `bundle_mobile_internet` | ❌ | ✅ **신규** | ❌ |
| `bundle_internet_tv` | ❌ | ✅ **신규** | ❌ |
| `bundle_mobile_internet_tv` | ✅ **신규** | ✅ **신규** | ✅ **신규** |

#### 잠근 셀렉터 (게이트 A)

| 공급사 | 앵커 | 티어명 | 가격 | 프로모 |
|---|---|---|---|---|
| Proximus | `[data-testid="PromoSpeed"]` / `PromoPrice` / `Pack-Composer-Product-Internet-Details` (문서 순서 zip) | PromoSpeed 텍스트 | `"€0 /month for 3 month(s), then €97.99 /month"` 파싱 | 같은 문장 |
| Telenet | `div.cmp-product-summary` + `tg-lazy-loading-standalone[component-id="tg-marketing-cafe-pricing"]` | `.heading--4` + `.heading--3` | `inputs` 속성 JSON `customProduct.price` | 같은 JSON `promoPrice` + `duration` (**추정 0**) |
| Orange | `div.obe-card` + `.obe-pricebox` | icon-table 제품명 3개 조합 | `.obe-price-amount` | `.obe-price-suffix` `"71 €/mois après 12 mois"` |

**셀렉터 선택 원칙**: `ssa-instance-<uuid>`(Orange) / `rs-*` 유틸리티 클래스(Proximus)는 렌더·디자인마다 바뀌므로 앵커로 쓰지 않는다. testid / 의미 클래스만 사용.

**오분류 가드**: 페이지 URL 을 카테고리 근거로 삼지 않는다. Orange 는 카드 헤더 `.obe-tag` 3종(Internet/Mobile/TV), Telenet 은 카드 본문의 구성 증거(다운로드 속도 / "mobiele data" / "TV-box")를 **카드가 스스로 밝힐 때만** 편입한다. 페이지 개편으로 다른 상품이 섞여도 조용히 오분류되지 않는다.

#### 실측으로 잡은 함정 4건

1. **Telenet 반응형 중복 카드** — 같은 요금제가 최대 4벌 렌더된다 (`startingFrom` 변형 등). 중복 제거 없이는 같은 slug 가 4번 upsert 되어 마지막 값이 이긴다. `heading|속도` 키 first-wins + 가격이 다르면 warning.
2. **Telenet mobile 결합가 혼입** — `"In combinatie met internet nu vanaf € 56"` 카드의 €10/€21 은 **인터넷과 함께 살 때의 조건부 가격**이다. 단독가(€21/€41)와 이름이 같아 걸러내지 않으면 요금제가 절반 가격으로 노출된다. (이 카드들은 1.5.6 당시 `price=0` 이라 자동 skip 됐으나 2026-08 페이지 개편으로 실가격이 채워졌다 — **조용한 회귀**였다.)
3. **`2,5 Gbps` → data_gb 5** — `(\d+)\s*GB/i` 가 "2,**5 Gb**ps" 를 데이터 용량으로 오인. `(?![a-z])` 경계 필요.
4. **정수 유로 표기** — Proximus 프로모가가 `€0` / `€30` 처럼 정수다. 소수점 필수 파서(`eurToCents`)로는 못 읽는다. §D6 "부정 판정 시 2개 표기 패턴 재확인" 교훈의 **코드판**.

#### ⚠️ 회귀 발견 2 — Proximus `internet_fixed` 가 4 → 1 로 줄어 있었다 (2026-08-20)

같은 라운드의 후속 점검에서 발견. `/en/internet` 이 **4개 요금제 중 1개(Light Fiber)만** 산출하고 있었다.

원인은 위 함정 4번(**정수 유로 표기**)과 **동일 캠페인**이다. "3 months free" 가 시작되며 표시가가 `€0 /month` 정수가 됐고, 소수점 필수 파서(`eurToCents`)가 이를 읽지 못해 Go / Mega / Giga Fiber 3개가 조용히 유실됐다.

| 요금제 | `[data-testid="PromoPrice"]` 원문 | 이전 | 이후 |
|---|---|---|---|
| Internet Light Fiber | `€39.99 /month` | ✅ | ✅ €39.99 |
| Internet Go Fiber | `€0 /month for 3 month(s), then €59.99 /month` | ❌ 유실 | ✅ €59.99 (프로모 €0 × 3개월) |
| Internet Mega Fiber | `€0 /month for 3 month(s), then €64.99 /month` | ❌ 유실 | ✅ €64.99 |
| Internet Giga Fiber | `€0 /month for 3 month(s), then €77.99 /month` | ❌ 유실 | ✅ €77.99 |

**단순히 정수 파서로 바꾸는 것으로는 부족했다.** 카드 본문에 총 할인액(`€179.97` = 3 × €59.99)이 함께 있어, 기존의 *"표시가보다 큰 값 중 최댓값 = 정가"* 규칙은 **총 할인액을 월정액으로 오인**한다. `PromoPrice` 한 문장이 프로모가·기간·정가를 모두 명시하므로 그 문장을 1순위 경로로 삼고, testid 가 없는 구조에서는 기존 로직으로 fallback 한다 (구 마크업 회귀 테스트 존치).

#### ⚠️ 구조적 취약점 — Proximus 두 페이지가 같은 앵커를 쓴다

같은 점검에서 확인: `/en/internet` 과 `/en/packs` 가 **`PromoSpeed` / `PromoPrice` / `Pack-Composer-Product-Internet-Details` 를 각각 4쌍씩 동일하게** 쓴다. 즉 testid 앵커만으로는 두 페이지를 구분할 수 없고, **페이지 URL 이 유일한 카테고리 근거**인 상태였다 — Telenet/Orange 파서에 적용한 원칙의 예외가 Proximus 에만 남아 있었던 셈이다.

두 페이지의 유일한 판별 신호는 카드 본문의 `"N GB mobile data"` (packs 8건 / internet 0건). 번들 파서가 이 증거가 없는 카드는 **warning 후 건너뛰도록** 바꿨다. 지금 당장의 오분류는 없었지만(URL 이 달라서), Proximus 가 레이아웃·리다이렉트를 바꾸면 인터넷 단품이 트리플 플레이로 둔갑했을 것이다.

#### ⚠️ 회귀 발견 — Orange `internet_fixed` 가 죽어 있었다

4.26.a 검증 중 발견. `/fr/produits-et-services/internet-chez-vous` 를 raw fetch 하면:

- `.obe-pricebox` **0개** (2026-06-05 정찰 시 3개) → 정적 가격 마크업 소멸
- `obe-dps-price` 마커 **8개** → JS 런타임 렌더 (Orange mobile 이 막힌 것과 동일 패턴, [ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) Amendment 4)
- 상품명 개편: Start / Zen / Giga Internet → **Livebox / Livebox Up / Livebox Giga**
- 실가격은 configurer(`?internet=` — robots Disallow) 뒤로 이동

즉 **Orange internet fetcher 는 언젠가부터 매일 파싱 실패 중**이었고, 그 결과 DB 에는 *더 이상 존재하지 않는 상품*(Start/Zen/Giga)이 `isActive=true` 로 남아 있었다. persist 의 단종 처리는 "이번에 본 카테고리" 스코프라 아무도 이 행들을 정리하지 못했다.

**조치**: (a) `orange-be` metadata 에서 `internet_fixed` 선언 제거 — 없는 커버리지를 주장하지 않는다 (P3), (b) [ADR-0008 Amendment 1](0008-fetcher-interface-and-cron.md) `retiredCategories` 신설 — fetcher 가 커버 중단을 선언하면 persist 가 잔존 요금제를 비활성화, (c) 파서 코드는 존치 — Orange 가 정적 가격을 되돌리면 실측이 선언을 이겨 자동 복구.

**교훈**: fetcher 실패는 "데이터가 안 늘어난다" 가 아니라 **"틀린 데이터가 계속 살아 있다"** 로 나타난다. fetcher 별 연속 실패 알림이 없다는 것이 부채로 확인됐다 (후속 항목 필요).

#### 남은 5칸 (정직 표기)

| 빈칸 | 사유 |
|---|---|
| Orange `mobile` | `obe-dps-price` JS 렌더 (ADR-0013 Amd 4 에서 반증 완료) |
| Orange `internet_fixed` | 위 회귀 — JS 렌더 전환 |
| Orange `bundle_mobile_internet` / `bundle_internet_tv` | 해당 조합의 정적 목록 페이지 없음 (configurer 쿼리 URL 뒤 = robots Disallow) |
| Proximus `bundle_mobile_internet` / `bundle_internet_tv` | `/en/packs?products=internet,mobile` 형태의 **쿼리 URL** 로만 노출. Proximus robots 는 이를 금지하지 않지만(2026-08-19 실측), §B.10.5 잠금 조건("정적 상품 목록 페이지만")을 공급사 구분 없이 지켰다. 완화하려면 ADR Amendment. |

### D7. 공급사 확장 트랙 (후행)

PR #84 로 시드된 제외 공급사 10건에 §D1 6축 심사를 적용하는 라운드. **Q1 / Q2 는 이 트랙 진입 시점에 잠근다.** Youfone BE 도메인 확인이 진입 과제에 포함된다.

## 운영자 결정 영역

### Q3 — 순서: 번들 먼저 vs 공급사 먼저 → ✅ **(가) 번들 먼저 잠금 (2026-08-15)**

| 옵션 | 근거 | 결과 |
|---|---|---|
| **(가) 번들 먼저** | 15칸 중 번들 9칸이 전부 0. 베네룩스는 번들 가입이 주류 — 기존 3사 번들만 채워도 커버리지 27% → 60% | ✅ **채택** |
| (나) 공급사 먼저 | 운영자 원 니즈("사업자가 2개뿐")에 직접 답함 | 후행 (§D7) |
| (다) 병행 | 사이즈 초과 우려 | 거부 |

### Q1 — 정찰 범위 · Q2 — 우선순위 가중치 → **이연 (4.26.b 진입 시점)**

Q3 잠금이 두 질문의 **대상을 바꿨다.** 번들 트랙은 대상이 기존 3사로 이미 확정돼 있어 "범위"와 "우선순위"를 물을 것이 없다. 두 질문은 §D7 공급사 확장 트랙의 질문이므로 그 진입 시점에 잠근다.

| 이연된 질문 | 원 옵션 |
|---|---|
| Q1 정찰 범위 | (가) 10건 전부 ~1.5d / (나) 상위 N건 ~0.7d / (다) 실측 기반 자동 축소 ~1.0d |
| Q2 우선순위 가중치 | §D4 산식 그대로 vs 세 인자 중 하나 가중 |

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
