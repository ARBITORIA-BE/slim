# ADR-0013: PLAN 1.5.6 실 스크래핑 진입 전 리스크 평가 + 분기 결정

## Status

**Proposed (2026-05-09)** — GATE-F (운영자 분기 검토) 직후 다음 중 하나로 격상:
- **Accepted** (분기 LOW/MEDIUM 둘 중 하나의 권장 채택)
- **Deferred** (HIGH 또는 운영자 추가 평가 요청 — 1.5.6 보류)

본 ADR은 **결정 + 권장만** 한다. 실 fetcher 코드 변경 X, fetcher 메타 변경 X,
새 의존성 X. 분기 실행은 GATE-F 후 builder 또는 architect 후속 라운드.

## Context

### 본 ADR이 다루는 항목

- **PLAN 1.5.6** — Proximus + Telenet 스텁 fetcher (1.8) → 실 스크래핑 fetcher
  로 전환하는 부채. 현재 `src/fetchers/proximus.ts` + `src/fetchers/telenet.ts`
  는 `method: 'stub'` + `confidence: 'low'` (ADR-0011 §T2 항목 3에 의해
  /data-sources에서 정직 라벨링).
- **베타(페이즈 4) 일정 의존성** — ADR-0003 §결정 5는 페이즈 4를 M8~M10에
  배치. 1.5.6이 페이즈 4 *전*에 완료될지 *후*에 완료될지는 본 ADR 분기에 달림.
- **운영자 사전 학습** — Kim Wonmin이 이전 프로젝트(arbitoria.com)에서 외부
  시스템 자동 차단을 직접 겪음:
  - **Reddit 광고 차단**
  - **Facebook 광고 차단**

  통신사 웹사이트는 광고 플랫폼보다 *덜 정교*할 가능성도 있고 *더 정교*할 가능성도
  있다 (Cloudflare/Akamai/자체 봇 탐지 + JS 챌린지 + TLS 핑거프린팅). 본 ADR은
  이 사전 학습을 *명시 인용*해 평가의 출발점에 둔다.

### 본 ADR이 *결정하지 않는* 것

- 실 스크래핑 fetcher의 *코드 모양* — ADR-0008 인터페이스 그대로. 본 ADR이
  변경하지 않음.
- 1.5.6 진행 *시점* — 분기 LOW/MEDIUM/HIGH 결정만; 실제 진입은 GATE-F 후 운영자
  의식적 선택.
- legal 에이전트 1차 호출 *결과* — 본 ADR 평가 7에서 *권장*만, 호출 자체는
  GATE-F 후.

### 본 ADR이 직접 받는 의존성

- **헌법 §8 #2** — "공급사가 보낸 가격을 가공하지 않는다" → 스크래핑은 *그대로
  가져오기*만 강제. 가격 변형 0.
- **헌법 §3 P3** — 투명성 운영자의 짐. /data-sources에서 method='stub' →
  'scraping' 라벨 변경의 신뢰 정합성을 결정.
- **ADR-0008 §T3** — confidence 휴리스틱. 실 스크래핑 진입 시 selectorMatched=
  true + sanity 통과 시 'high'까지 격상 가능. 단 ADR-0008 §T3은 *down-grade
  only* 정책 — fetcher가 자체 sanity로 'low' override 가능.
- **ADR-0009 §결정 1** — Proximus + Telenet BE 시장 ≥ 75% 점유 (Telecompaper
  Q1 2025). 1.5.6 진입은 본 시장 대표성 가정에 의존하지 않음 — 데이터 *신선도*
  격상이 목표.
- **ADR-0010 §T5** — Confidence 전파 = `min(현재, 후보)` 보수적 floor. 실
  스크래핑 후 'high' 격상이 비교 결과 품질에 직접 영향.
- **ADR-0011 §T2 항목 3** — `/data-sources` method 라벨이 'stub' → 'scraping'
  으로 단일 변경. *형식 근거가 본 라벨 변경 트리거*.
- **MONETIZATION.md §A 윤리 가드레일 #1** — "순위 무영향". 어필리에이트 네트워크
  데이터 피드를 1차 데이터로 사용 시 *데이터 출처 = 어필리에이트*가 되는 셈 →
  순위 영향 가능성을 §평가 5에서 추가 검토.

### 본 ADR이 여는 후속

- **GATE-F 통과 후 LOW**: builder가 Telenet 1개 fetcher 실 구현 (Cheerio 추가
  + HTML 파싱)
- **GATE-F 통과 후 MEDIUM**: 1.5.6 페이즈 5/6으로 미룸 — 1.5.4/1.5.1/1.5.2/
  1.5.3 부채 처리 우선
- **GATE-F 통과 후 HIGH**: 1.5.6 무기한 보류 + 어필리에이트 네트워크 가입 또는
  BIPT 데이터 수동 import 시뮬레이션 별도 ADR 신설

### 운영자 컨텍스트 (`docs/FOUNDER.md`)

- 솔로 사이드, 주 10-20시간, 월 €300 ALL-IN
- 개발 3개월 (학습자 모드) — 실 스크래핑 디버깅은 시간 sink
- TVA 대기 중 → 어필리에이트 네트워크 가입 자격에 영향 (§평가 5)
- 외부 변호사 €800/주 거부 (ADR-0004) → legal 에이전트 자체 검토 의존 (§평가 7)

## External facts (검증된 출처, 2026-05-09)

### Proximus

- **robots.txt** ([proximus.be/robots.txt](https://www.proximus.be/robots.txt))
  — `User-agent: *` (모든 봇), 차단 경로 = `/cgi-bin/`, `/web/`, `/GSA/`,
  `/api/`, `/rest/`, `/dam/.../pdfs/`, `/private/`, `/companies/gallery/...`,
  `/epp/`, `/formbuilder/`, `/logout`, `/media/main/$`, `/media/smartphones/$`.
  **요금제 페이지(`/en/personal/products/mobile/...` + `/en/personal/products/internet/...`)
  는 차단 X**. Sitemap 명시 (`http://www.proximus.be/sitemap.xml`). Crawl-delay
  부재.
- **Legal information** ([proximus.be/.../legal-information.html](https://www.proximus.be/en/id_cr_warnland/personal/orphans/legal-information.html))
  — "All rights reserved. © Proximus" 외에 *자동 접근 / 스크래핑 명시 금지
  조항 없음* (WebFetch 2026-05-09). "Automated interactions with our customer
  service" 섹션은 AI 사용 *기술*이지 *고객 측 자동화 금지*가 아님. 단 General
  Terms PDF (`/dam/jcr:7a6be979-.../GTC`)는 본 ADR 단계에서 미열람 (PDF 본문
  추출 실패 — §평가 7 외부 변호사 또는 legal 에이전트 후속).
- **AUP** ([proximus.be/.../aup_v2_en.pdf](https://www.proximus.be/dam/jcr:6b78a97b-4787-41aa-9eb6-ef4fd7ca008d/cdn/sites/iportal/documents/pdfs/common/aup_v2_en~2022-01-21-09-22-51~cache.pdf))
  — *Proximus 인터넷 회선 가입자*가 인터넷을 사용할 때의 정책. **웹사이트 방문자
  스크래핑 정책과 다른 스코프**. 본 ADR이 다루는 위험 = 웹사이트 방문자 스크래핑이
  므로 AUP 본문은 직접 적용 X (단 운영자가 Proximus 인터넷 가입자라면 *그 IP에서
  스크래핑 시* AUP가 추가 적용 — 운영자가 다른 ISP 사용 권장).

### Telenet

- **robots.txt** ([www2.telenet.be/robots.txt](https://www2.telenet.be/robots.txt))
  — `User-agent: *` + `Allow: /` (관대), 차단 경로 = `*/jcr:content/*`,
  `*/etc/*` (단 `/etc/*.js`, `/etc/*.css`는 Allow). Sitemap 4개 (residential/
  business/corporate/main). Crawl-delay 부재. **요금제 페이지(`/residential/`)
  는 명시 차단 X**.
- **Algemene voorwaarden** ([www2.telenet.be/.../algemene_voorwaarden_res_final_01032022.pdf](https://www2.telenet.be/content/dam/www-telenet-be/klantenservice/downloads/algemene_voorwaarden_res_final_01032022.pdf))
  — Dutch PDF, 본 ADR 단계에서 본문 텍스트 추출 미시행. 일반적인 BE 통신 약관에
  서비스 가입자에 대한 정책은 있지만 *비-가입 웹사이트 방문자 스크래핑 명시
  금지*는 흔치 않음 (§평가 7 legal 에이전트 후속).
- 참고: Dutch 법학 블로그 ([Ius Mentis 2015 — "Scrapen mag in de gebruiksvoorwaarden
  worden verboden"](https://blog.iusmentis.com/2015/01/16/scrapen-mag-de-gebruiksvoorwaarden-worden-verboden-argh/))
  — 네덜란드/벨기에 법체계에서 가용 약관에 스크래핑 금지를 *명시*하면 법적 구속
  가능. 명시가 없으면 *기본 허용*에 가까움 (단 EU 1996 데이터베이스 보호 지침
  + 자기 데이터 추출 추가 보호 가능).

### 봇 차단 시스템

- 일반 사실 ([Cloudflare bot detection engines](https://developers.cloudflare.com/bots/concepts/bot-detection-engines/)
  / [Akamai/Cloudflare/Imperva detection](https://wilico.co.jp/en/blog/why-akamai-cloudflare-imperva-detect-scraping)):
  Akamai sensor.js + Cloudflare cf-mitigated 헤더 + JS 챌린지 + TLS 핑거프린팅.
- **Proximus / Telenet 특정 사용 여부**: 공개 문서 부재. 1.5.6 진입 시 첫 fetch
  HTTP 응답의 `Server`, `cf-ray`, `x-akamai-*` 헤더로 *런타임 검증*해야 정확.
  **본 ADR은 보수적으로 "있음" 가정** (운영자 사전 학습 + 통신사 규모 + B2C
  사이트 표준 보호 패턴).

### 대안 데이터 소스

- **BIPT 공식 비교 도구** ([besttariff.be](https://www.besttariff.be/) +
  [BIPT — Comparing offers with a tool](https://www.bipt.be/consumers/comparing-offers-with-a-tool))
  — BIPT(통신 규제기관)가 EasyChange와 라이센스 계약. **모바일/유선/광대역/
  번들 모두 포함 + 모든 BE 공급사 ("comprehensive")**. 단 **공개 CSV/API 부재**
  (WebFetch 2026-05-09 — 사이트 본문에서 다운로드/API 메뉴 미발견). 데이터
  재배포 정책 명시 부재. 즉 *수동 구문 분석은 가능, 자동 import는 회색지대*.
  ⇒ 1.5.6의 *직접 대체*는 약함, 단 가격 검증 *교차 점검*에 활용 가능.
- **BIPT 통계 포털** ([BIPT Statistics](https://www.bipt.be/operators/telecommunications/statistics))
  — 시장 점유율/매출 등 *집계* 데이터. 가격 비교에는 부적합.
- **Daisycon** ([Daisycon — telecom in BE 카테고리](https://www.varamedia.be/affiliate-marketing-agency/vergelijking-tradetracker-daisycon-awin-en-tradedoubler/))
  — BE 통신 카테고리 활성. 가입 자격 = 보통 회사(VAT 또는 KVK 등록) 필요.
  **운영자 TVA 대기 중**이므로 가입 가능 시점은 TVA 발급 후 (수일~수주). 가입
  후 advertiser별 product feed (CSV/XML) 제공 — *Proximus / Telenet의 advertiser
  활성 여부는 가입 후에야 확인 가능*.
- **Awin** ([Awin Belgium 서비스](https://www.varamedia.be/affiliate-marketing-agency/vergelijking-tradetracker-daisycon-awin-en-tradedoubler/))
  — BE 시장은 NL 오피스에서 서비스. 텔레콤 카테고리 활성. 가입 자격 동일 (VAT).
- **TradeDoubler** — BE 자체 오피스 X, 텔레콤 카테고리 활성. 가입 자격 동일.
- **경쟁 비교 사이트**:
  - [besttariff.be](https://www.besttariff.be/) — BIPT 공식 (자동 구축이 아니라
    EasyChange가 *수동 큐레이션 + API 통합*. 즉 솔로 단독으로는 재현 불가).
  - **Test-Aankoop / TestAchats** — 소비자 단체. 가격 비교는 *유료 회원*에게만,
    데이터 출처는 *수동 수집* 추정.
  - 결론: *모든 BE 비교 사이트가 자동 스크래핑이 아닌 수동 큐레이션 + 부분 API*
    혼합으로 추정. 솔로 단독 재현은 비현실 — 어필리에이트 피드 또는 BIPT 라이센스
    필요.

### GDPR

- 요금제 가격 페이지는 *공개 가격 정보* — **개인정보 0**. GDPR Art. 6 합법근거
  필요 X.
- Slim 자체의 IP reputation 리스크: 운영자 IP가 Vercel FRA1 엣지 또는 Inngest
  worker IP. **arbitoria.com 도메인 인식 가능성 = 낮음** (운영자가 다른 GitHub
  org / 다른 도메인 / 다른 호스팅). 단 첫 fetch *후* 차단 시 Vercel 전체 IP
  대역에 영향 가능 (다른 Vercel 프로젝트도 차단). ⇒ **모니터링 GATE 필수**.

## Decision

7개 평가 + 종합 리스크 분류 + 분기 권장.

### 평가 1 — robots.txt + TOS 정책

| 공급사 | robots.txt 차단 | TOS 자동 수집 명시 금지 | 점수 (1=낮은리스크, 5=높은리스크) |
|---|---|---|---|
| Proximus | 요금제 페이지 차단 X (요청대로 fetch 가능) | Legal info 페이지에 명시 금지 *없음*. General Terms PDF 미열람. | **2** |
| Telenet | 요금제 페이지 차단 X. `Allow: /` 관대. | Algemene voorwaarden PDF 미열람. | **2** |

**근거**: robots.txt가 명시 차단 안 하는 한 BE 법체계에서 *기본 허용*에 가까움
(Ius Mentis 2015). 단 General Terms PDF 두 개를 legal 에이전트가 텍스트 추출 후
재검토 필요 — 명시 금지 발견 시 점수 4로 격상.

### 평가 2 — HTML 구조 안정성

| 공급사 | 추정 사이트 유형 | 6개월 내 변경 빈도 추정 | 셀렉터 fragile | 점수 |
|---|---|---|---|---|
| Proximus | SSR + 부분 SPA (대형 통신사 표준) — `/en/personal/products/mobile/mobile-subscriptions/proximus-mobile.html` 라우트 형식이 CMS-driven | 분기 1회 마이너 + 연 1회 메이저 (요금 개편) | **medium** (CMS 마크업이 데이터 속성 안정적, 단 promo 가격은 dynamic class) | **3** |
| Telenet | 동일 — `/residential/en/products/...` CMS 라우트 | Telenet은 2024 Liberty Global 합병 → 사이트 리브랜딩 진행 중 (위험 ↑) | **medium-high** (Telenet 리브랜딩 영향 미상) | **3-4** |

**근거**: 두 사이트 모두 SPA 단일 fetch 후 정적 HTML 파싱이 가능할 *가능성*이
높음 (서버 렌더링이 SEO에 필요 → 통신사 SEO 우선순위 높음). Cheerio 단일
의존성으로 충분 추정. 단 Telenet 리브랜딩이 1.5.6 시점에 진행 중이면 셀렉터
재작업 1-2회 발생 가능.

### 평가 3 — 봇 차단 시스템

**보수 가정**: Proximus + Telenet 모두 Cloudflare 또는 Akamai 사용 가능성
**높음** (B2C 통신사 + 광고 차단 운영자 사전 학습). 첫 fetch *전*에 검증 불가
(공개 문서 부재).

| 공급사 | 추정 보호 시스템 | rate limit | 차단 트리거 추정 | 점수 |
|---|---|---|---|---|
| Proximus | Cloudflare 가능성 (B2C 표준) | 명시 부재 → 보수적 1 req/sec | UA 'bot' / Headless / TLS fingerprint mismatch | **3** |
| Telenet | Cloudflare 또는 자체 (Liberty Global 인프라) | 동일 보수 | 동일 + Liberty Global 인프라 추가 패턴 | **3** |

**근거**: Slim의 cron은 일 1회 1 fetcher = 1 req/일/공급사 — *rate limit 자체로
는 차단 트리거 가능성 매우 낮음*. 단 UA 헤더 + TLS 핑거프린트 + headless 탐지
(undici의 Node.js TLS handshake가 *실 브라우저*와 다름)로 첫 fetch 즉시 차단
가능성은 상존. **선제 대응 = User-Agent 정직 명시 + Slim 도메인 referrer 명시**
(P3 정합).

### 평가 4 — GDPR 영향

| 차원 | 평가 | 점수 |
|---|---|---|
| 요금제 페이지 PII 부재 | **확정** — 가격은 공개 정보, 개인정보 0 | **1** |
| Slim 자체 IP reputation | Vercel FRA1 + Inngest worker IP. arbitoria.com 도메인 인식 가능성 낮음. | **2** |
| 첫 fetch 후 Vercel 대역 차단 시 다른 프로젝트 영향 | 가능 — Vercel 무료 IP 풀 공유 | **3** |

**종합 점수: 2** (PII 부재가 결정적, IP reputation은 모니터링으로 관리 가능).

**근거**: GDPR Art. 6 합법근거 자체는 필요 없음 (PII 0). 단 *Slim의 봇 행동이
공급사 사이트에 부담을 주면* PECR(EU ePrivacy)이 *공개 데이터에도 적용*되는
회색지대 가능성 — legal 에이전트 1차 호출 권장 (§평가 7).

### 평가 5 — 대안 데이터 소스

| 대안 | 가용성 | 솔로 비용 | 가입 자격 | 점수 (1=좋은대안, 5=대안 약함) |
|---|---|---|---|---|
| **Daisycon** product feed | 텔레콤 카테고리 활성, BE 시장 | 가입 무료, 수수료는 클릭/전환 발생 시만 | TVA 필요 (운영자 발급 대기) | **2** (TVA 후 즉시 가능, MONETIZATION-A와 자연 정합) |
| **Awin** product feed | 동일 | 동일 | TVA 필요 | **2** |
| **TradeDoubler** product feed | 동일 (BE 오피스 X) | 동일 | TVA 필요 | **3** |
| **BIPT besttariff.be** | 모든 BE 공급사 + 모든 카테고리, *공개* | CSV/API 부재 → 수동 또는 회색지대 자동 fetch | 라이센스/연락 필요 | **4** (가장 권위 있으나 자동화 어려움) |
| **수동 import** (운영자가 매월 가격 입력) | 보장됨 | 솔로 시간 비용 ≈ 1h/월 (10 tariff × 5분) | 없음 | **2** (P3 정합 — method='manual' 라벨, 가장 단순) |

**핵심 인사이트**:
- **MONETIZATION-A 어필리에이트 단가 출처와 데이터 출처가 *동일* 어필리에이트
  네트워크라는 가능성**은 **윤리 가드레일 #1 (순위 무영향) 위협**. Daisycon
  product feed에 포함된 공급사가 알고리즘 1위에 오는 빈도가 높아지면 — *어필
  리에이트 네트워크 가입 = 순위 영향* 의혹. ⇒ **Daisycon/Awin 가입 시 데이터
  출처 = 어필리에이트 네트워크라는 사실을 /data-sources 페이지에 노출** (P3).
- **수동 import 옵션은 가장 단순 + P3 정합** (`method='manual'` 라벨이 이미
  ADR-0008 §T5에 정의됨, 사용자에게 정직). 단점 = 솔로 시간 의존, 1.5.6 자동화
  목표와 정면 배치.

**평가 5 종합 점수: 2-3** (대안은 풍부, 단 각각 트레이드오프).

### 평가 6 — 베타 시나리오

| 옵션 | 설명 | 베타 진입 시점 | P3 정직성 | 점수 |
|---|---|---|---|---|
| **X — 스텁 데이터로 베타 출시** | 현재 스텁 fetcher 유지, 사용자에게 "추정값" 표시 | M8 (정상) | "이 가격은 운영자가 2026-05-09에 수동 검증한 추정값. 실 신선도는 첫 어트리뷰션 검증 후 격상." 헌법 P3 정합 가능. | **2** |
| **Y — 실 데이터 필수** | 1.5.6 완료 전 베타 불가 | M8 차단 → M10+ | 가장 정직 | **4** (베타 일정 직접 위험) |
| **Z — 어필리에이트 피드 + 베타** | TVA 발급 후 Daisycon 가입 → product feed → 베타 | TVA + 가입 1주 후 | "데이터 출처: Daisycon advertiser feed" /data-sources 노출 필수 | **2** |

**근거**: 옵션 X(스텁 데이터로 베타)가 가장 빠르고 헌법 P3에 *순응 가능* (정직
표시). 단 베타 사용자가 "추정값"으로 의사결정 시 책임 분담은 운영자. *피드백
신호*는 충분 (모집 → 입력 → 결과 페이지 UX 평가) — 실 가격이 아니더라도 패널이
유용. **MONETIZATION § A의 어트리뷰션 검증은 옵션 X에서 부분만 가능** (실 변경
완료 시점에 단가만 정확).

### 평가 7 — 법적 검토 필요

| 차원 | 권장 | 외부 비용 | 점수 |
|---|---|---|---|
| Proximus General Terms PDF 본문 검토 | **legal 에이전트 1차 호출** (PDF 텍스트 추출 + 자동 수집 명시 금지 검색) | €0 (자체) | **2** |
| Telenet Algemene voorwaarden PDF 검토 | 동일 | €0 | **2** |
| EU 1996 Database Directive 적용 검토 | legal 에이전트 (EU 법원 case law 참조) | €0 | **3** (ECJ Innoweb 2013 case 등 참조 필요) |
| 외부 변호사 €800/주 | **거부됨** (ADR-0004 §결정 3) — 자체 legal 에이전트 우선, 외부는 베타 직전 €800 1회 + 수익 €5K/월 시점 | €0 (현재) → €800 (M8/M16) | **3** |

**평가 7 종합 점수: 2-3**. legal 에이전트 1차 호출 *권장* — 본 ADR이 호출하지
않음 (architect 한 라운드 끝). GATE-F 통과 후 사용자가 legal 호출 트리거.

## 종합 리스크 분류

### 4 차원 점수 (1=낮음, 5=높음)

| 차원 | 점수 | 가중치 | 가중 점수 | 근거 |
|---|---|---|---|---|
| **1. 법적 리스크** (TOS + GDPR + IP reputation) | **2.3** | 0.30 | 0.69 | robots.txt 허용 + PII 부재 + IP reputation 관리 가능. 단 General Terms PDF 미검토 잔여 위험. |
| **2. 기술적 리스크** (HTML 안정성 + 봇 차단) | **3.0** | 0.30 | 0.90 | Cloudflare/Akamai 보수 가정 + Telenet 리브랜딩 진행. 첫 fetch 전 검증 불가 — 운영자 사전 차단 학습이 직접 적용. |
| **3. 베타 일정 영향** | **2.0** | 0.20 | 0.40 | 옵션 X (스텁 + 베타)가 *P3 정합 + 일정 무영향*. Y만 위험. |
| **4. 솔로 사이드 시간 비용** (디버깅 부담) | **3.5** | 0.20 | 0.70 | 셀렉터 깨짐 디버깅 sink + Cheerio 학습 + 차단 시 우회 학습. FOUNDER.md 솔로 학습자 컨텍스트에서 가장 큰 미지수. |
| **종합 가중 평균** | | | **2.69** | **MEDIUM** (2.1~3.5 구간) |

### 분류: 🟡 **MEDIUM** (2.69 / 5.0)

LOW (≤2.0) → MEDIUM (2.1~3.5) → HIGH (≥3.6)

**해석**:
- 법적 위험은 LOW에 가깝지만, 기술적 위험 + 솔로 시간 비용이 MEDIUM으로 끌어올림.
- "지금 진입해도 못 끝낼 가능성" > "지금 진입하면 차단될 가능성".

## 분기 권장 (자동 실행)

본 평가는 **🟡 MEDIUM → 옵션 C** 권장. GATE-F 운영자 검토 후 채택:

### 🟡 MEDIUM → 옵션 C (권장)

**다음 단계: 1.5.6을 페이즈 5 또는 페이즈 6으로 미룸.** 그 사이 작은 부채를
다음 우선순위로 처리:

1. **PLAN 1.5.4** (`scripts/**` typecheck 복원, P4 부채) — 추정 9건 미만 type
   에러, 1-2일.
2. **PLAN 1.5.1** (fetcher 코드 공통화) — 단 ADR-0009 §결정 3에 따라 N=2 표본은
   대기 권장. **재평가만**, 추출 0이면 조건부 skip.
3. **PLAN 1.5.2** (`harness:price` 첫 가동 + 90일 PII 일반화 cron) — 1.5.6 *없이*
   가동 가능 (스텁 데이터의 일관성 검증).
4. **PLAN 1.5.3** (`docs/runbook.md` 신설) — 솔로 self-rescue 체크리스트.
   1.5.6 진입 시 셀렉터 깨짐 대응 절차 사전 작성 → 1.5.6 *진입 비용 절감*.

**1.5.6 본문 갱신**: "ADR-0013 분기 결과 = MEDIUM, 페이즈 5 또는 6 재평가.
그동안 method='stub' 유지." 명시.

**이유**:
- 솔로 시간 비용 (3.5)이 가장 큰 점수 — 1.5.6 진입 전에 *주변 인프라(runbook,
  harness:price)를 완성*하면 1.5.6 진입 시 디버깅 시간이 50% 절감.
- 베타(페이즈 4)는 옵션 X(스텁 + "추정값" 표기)로 진행 가능 (§평가 6) — 1.5.6
  지연이 베타 일정에 *직접 영향 0*.
- 페이즈 5 진입 가능 시 (M16 게이트) Orange BE 추가 (5.0) 시점에 *3 fetcher
  공통화* 가치가 회복됨 → 1.5.1 + 1.5.6 두 부채를 한 번에 처리 가능 (시간
  효율 ↑).

### 🟢 LOW → 옵션 B (대체 권장 — 운영자가 시간 여유 충분 시)

**다음 단계: Telenet 1개 fetcher 실 구현** (Cheerio 추가 + HTML 파싱). 한
fetcher만 시작하는 이유:
- 첫 fetch 차단 여부 검증 — 한 사이트만 깨져도 다른 한 사이트는 보존 (위험
  분산).
- Cheerio 학습 곡선 첫 흡수 — 두 번째 fetcher는 50% 빠르게.
- ADR-0010 §T5 confidence floor 정책에 의해 한 fetcher만 'high'로 격상해도
  비교 결과 품질 향상 ("Telenet은 실 데이터, Proximus는 추정").

**24h 모니터링 GATE**:
- 첫 fetch 후 Inngest UI에서 step run 결과 확인.
- HTTP 응답 헤더 (`Server`, `cf-ray`, `x-akamai-*`) Sentry 로그.
- 차단 (HTTP 403/429/500) 또는 본문이 챌린지 페이지 (Cloudflare "Just a moment..."
  / Akamai sensor) 발견 시 즉시 운영자에게 알림 + fetcher 비활성 + ADR-0013
  Amendment.
- 24h 정상 시 Proximus도 동일 패턴 적용 (점진적 출시).

**구체 파일** (LOW 채택 시 builder 인계):
- 변경: `src/fetchers/telenet.ts` — 스텁 데이터 분기 제거 + 실 HTTP fetch (
  AbortController 25s) + Cheerio HTML 파싱 + 셀렉터 추출. `method: 'stub'` →
  `'scraping'`.
- 신설 의존성: `pnpm add cheerio` (1.0.0+, ~70KB gz). `pnpm add -D @types/cheerio`
  불필요 (cheerio 1.0.0+ 자체 타입).
- 변경: `src/fetchers/telenet.test.ts` — 모킹 패턴 (vitest `vi.mock('node-fetch')`
  또는 `msw`).
- 신설: `docs/runbook.md` — 셀렉터 깨짐 시 self-rescue (1.5.3과 통합 권장).

### 🔴 HIGH → 1.5.6 무기한 보류 + 대안 데이터 검토

**다음 단계** (HIGH 채택 시):
- **PLAN 1.5.6 status = "보류" 마킹** (PLAN.md `[!]` 차단됨 표기 + ADR-0013
  HIGH 인용).
- **별도 ADR 신설**: `0014-affiliate-feed-as-primary-data.md` — Daisycon/Awin
  product feed를 1차 데이터로 사용 + /data-sources에 출처 명시 (P3).
- **수동 import 시뮬레이션**: 운영자가 매월 1회 BIPT besttariff.be에서 수동
  검증 → JSON 직접 편집 (`method='manual'` 라벨 이미 ADR-0008 §T5에 정의).

**P3 시나리오**:
- 옵션 W (BIPT 수동) — 가장 권위 있음, 솔로 시간 1h/월
- 옵션 V (어필리에이트 피드) — 자동화 가능, 윤리 가드레일 노출 필수

## Alternatives considered (요약)

### 대안 1 — 평가 없이 즉시 실 스크래핑 진입 (거부)

- **장점**: 1.5.6을 즉시 처리, 일정 단축.
- **단점**: 운영자 사전 학습(arbitoria.com Reddit/FB 광고 차단) 직접 무시.
  첫 fetch 차단 시 디버깅에 *주 단위* 시간 소비 가능 → 페이즈 4 베타 일정
  *직접* 위험. P5 (결정은 ADR로) 위반.
- **거부 사유**: 평가 → 분기가 솔로 사이드에서 결정적 안전 메커니즘.

### 대안 2 — 페이즈 5까지 무조건 stub 유지 (거부)

- **장점**: 단순, 시간 비용 0.
- **단점**: 조사 *왜* 미루는지 명시 부재. P3 정직성 약화 (스텁 라벨이 사용자
  의사결정 신뢰에 부담). M16 평가 게이트 *fetcher 안정성 ≥ 95%* 신호가 스텁
  으로는 의미 없음 (ADR-0003 §결정 2).
- **거부 사유**: 본 ADR이 *왜 페이즈 5/6으로 미루는지* (운영 부채 우선 처리 +
  1.5.1 N=3 회복 시점 통합) 명시함으로 P5 정합.

### 대안 3 — Headless browser (Playwright/Puppeteer)로 우회

- **장점**: TLS 핑거프린팅 + JS 챌린지 우회 가능성 ↑.
- **단점**: Inngest free step timeout 30s 안에 headless 부팅(2-5s) + 페이지
  로드(2-10s) + 파싱(1-3s) = *마진 부족*. 메모리 ~150MB/실행 (Vercel function
  256MB cap 위협). Cheerio 단일 의존성 70KB 대비 Playwright 250MB+. 솔로
  학습자 디버깅 부담 ↑.
- **거부 사유**: 보수적 접근 — 첫 시도는 단순 fetch + Cheerio. 차단 시에만
  headless 검토 (별도 ADR).

## Consequences

### 본 ADR이 LOW로 격상 시 (옵션 B 채택)

- ✅ 1.5.6 진입 + Telenet 실 데이터 → confidence 격상 → 비교 결과 품질 ↑
- ⚠️ 24h 모니터링 GATE 통과 책임 운영자 주체. 차단 시 즉시 보고 의무.
- ⚠️ Cheerio 의존성 추가 (GATE-C 트리거 — ADR-0011 §T4 새 의존성 정책 정합 필요)
- 🔁 1.5.4/1.5.1/1.5.2/1.5.3 잔존 부채는 페이즈 1.5 정상 처리

### 본 ADR이 MEDIUM으로 격상 시 (옵션 C 채택, 권장)

- ✅ 1.5.4/1.5.2/1.5.3 부채 우선 처리 → 1.5.6 진입 시 인프라 완성
- ✅ 베타(페이즈 4) 일정 영향 0 — 옵션 X (스텁 + "추정값")로 진행
- ⚠️ 1.5.6이 페이즈 5/6으로 미뤄지는 동안 사용자 신뢰도 격상 X (스텁 라벨 유지)
- ⚠️ M16 평가 게이트 "fetcher 안정성 ≥ 95%" 신호 부재 — *대체 신호*로 *베타
  사용자 NPS* + *PR 매체 반응* 우선 측정 (ADR-0003 §결정 2 본문 그대로 유지)

### 본 ADR이 HIGH로 격상 시 (보류 + 대안)

- ✅ 자동 차단 위험 0 (스크래핑 안 함)
- ⚠️ MONETIZATION-A 어필리에이트 피드 의존 시 윤리 가드레일 #1 위협 — 별도 ADR
  필요
- ⚠️ 솔로 수동 import 1h/월은 베타 진입 후 사용자 부담 ↑ 시 confidence='manual'
  의 한계
- 🔁 1.5.1/1.5.6 두 부채가 페이즈 5+ Orange BE 추가 시 통합 처리

### 잃는 것 / 부채 (모든 분기 공통)

- General Terms PDF 두 개의 자동 수집 명시 금지 검토 미시행 — legal 에이전트
  1차 호출 후 본 ADR Amendment 1 가능
- 첫 fetch *전*에 Cloudflare/Akamai 사용 여부 검증 불가 — 보수 가정 유지
- 본 ADR이 베타 옵션 X (스텁 + "추정값")의 *UI 표기 정책*을 결정하지 않음 —
  페이즈 3.5 (결과 페이지 진입 시) 별도 결정

## 검증 방법

### 검증 1 — GATE-F 통과 직후

운영자가 LOW/MEDIUM/HIGH 중 하나 선택:
- LOW → 본 ADR Status를 `Accepted (옵션 B 채택, YYYY-MM-DD)` 로 격상
- MEDIUM → 본 ADR Status를 `Accepted (옵션 C 채택, YYYY-MM-DD)` 로 격상
- HIGH → 본 ADR Status를 `Deferred (옵션 - 보류, ADR-0014로 후속, YYYY-MM-DD)` 로 격상

### 검증 2 — LOW 채택 시 (24h 모니터링 게이트)

- Telenet 첫 fetch 실행 후 24h 내 Sentry 차단 알림 0건 → ADR 정당화
- 1건 이상 → fetcher 즉시 비활성 + ADR-0013 Amendment 1 (HIGH로 재분류)

### 검증 3 — MEDIUM 채택 시 (페이즈 5 진입 시점 재평가)

- M16 평가 게이트 통과 시 1.5.6 + Orange BE 5.0 통합 평가 ADR 신설
- 게이트 미통과 시 1.5.6 status는 "보류" 유지

### 검증 4 — 어필리에이트 네트워크 가입 영향 (모든 분기 공통)

TVA 발급 후 Daisycon/Awin 가입 시 — 본 ADR §평가 5 결론 (윤리 가드레일 #1
위협)을 /data-sources 페이지 디자인 결정에 반영. 별도 ADR 신설 트리거.

## 영향

### PLAN.md 갱신

- **§1.5.6** 본문 마지막 줄에 인용 추가:
  > 진행 또는 보류 분기는 [ADR-0013](docs/adr/0013-fetcher-real-scraping-risk-assessment.md)
  > §분기 권장에 따른다. 현재 평가: **MEDIUM** — 페이즈 5/6 재평가.
- §작업 추적 메타 표 합계 변동 X (체크박스 마킹 X — 본 ADR은 평가만)
- Scope cut 옵션 표 변동 X (본 ADR은 새 옵션 도입 X)

### 다른 ADR과의 관계

- **ADR-0008 §T3** confidence 휴리스틱 — 본 ADR로 변경 0 (실 스크래핑 진입 시
  selectorMatched=true 가능 → 'high' 격상 가능, 정책은 그대로)
- **ADR-0009** Proximus + Telenet 시장 점유율 가정 — 본 ADR로 변동 0
- **ADR-0010 §T5** confidence floor — 본 ADR로 변동 0
- **ADR-0011 §T2 항목 3** method='stub' → 'scraping' 라벨 변경 — 본 ADR
  분기에 의존 (LOW: Telenet만 'scraping' / MEDIUM: 변동 X / HIGH: 'manual'
  도입 가능)

### MONETIZATION.md 영향

- §A 윤리 가드레일 #1 (순위 무영향) 정합성 검토 트리거 — 어필리에이트 피드를
  데이터 출처로 채택 시 별도 ADR-0014 신설

## References

### 헌법 + 운영자 컨텍스트
- [`CLAUDE.md`](../../CLAUDE.md) — §3 P1 P3, §8 #2, §5 기술 스택
- [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 주 10-20시간, 월 €300, TVA
  대기, 운영자 사전 학습 (arbitoria Reddit/FB 광고 차단)

### 관련 ADR
- [ADR-0003](0003-plan-realism-solo-side.md) — §결정 1 카테고리, §결정 5 페이즈
  1 일정
- [ADR-0004](0004-monetization-solo-side-rebalance.md) — §결정 3 외부 변호사 거부
- [ADR-0008](0008-fetcher-interface-and-cron.md) — §T3 confidence 휴리스틱, §T5
  method enum, §T7 격리 메커니즘
- [ADR-0009](0009-scope-cut-fetcher-2-providers.md) — §결정 1 Proximus + Telenet,
  §결정 3 1.5.1 N=2/N=3
- [ADR-0010](0010-comparison-engine.md) — §T5 confidence floor
- [ADR-0011](0011-data-sources-page-and-caveats-boundary.md) — §T2 항목 3 method
  라벨 변경 트리거

### 외부 사실 — robots.txt + TOS
- [proximus.be/robots.txt](https://www.proximus.be/robots.txt) — 요금제 페이지
  명시 차단 X
- [www2.telenet.be/robots.txt](https://www2.telenet.be/robots.txt) — `Allow: /`
  관대
- [Proximus Legal information](https://www.proximus.be/en/id_cr_warnland/personal/orphans/legal-information.html)
  — 자동 접근 명시 금지 부재
- [Proximus AUP PDF](https://www.proximus.be/dam/jcr:6b78a97b-4787-41aa-9eb6-ef4fd7ca008d/cdn/sites/iportal/documents/pdfs/common/aup_v2_en~2022-01-21-09-22-51~cache.pdf)
  — 인터넷 가입자 정책 (스코프 다름)
- [Telenet Algemene voorwaarden PDF](https://www2.telenet.be/content/dam/www-telenet-be/klantenservice/downloads/algemene_voorwaarden_res_final_01032022.pdf)
  — 본 ADR 단계에서 본문 미열람
- [Ius Mentis 2015 — "Scrapen mag in de gebruiksvoorwaarden worden verboden, argh"](https://blog.iusmentis.com/2015/01/16/scrapen-mag-de-gebruiksvoorwaarden-worden-verboden-argh/)
  — NL 법체계 명시 금지 시 구속

### 외부 사실 — 봇 차단
- [Cloudflare bot detection engines](https://developers.cloudflare.com/bots/concepts/bot-detection-engines/)
- [How Akamai, Cloudflare, and Imperva Detect Web Scraping](https://wilico.co.jp/en/blog/why-akamai-cloudflare-imperva-detect-scraping)

### 외부 사실 — 대안 데이터 소스
- [BIPT — Comparing offers with a tool](https://www.bipt.be/consumers/comparing-offers-with-a-tool)
- [besttariff.be](https://www.besttariff.be/)
- [BIPT Statistics](https://www.bipt.be/operators/telecommunications/statistics)
- [VaraMedia — TradeTracker vs Daisycon vs Awin vs TradeDoubler](https://www.varamedia.be/affiliate-marketing-agency/vergelijking-tradetracker-daisycon-awin-en-tradedoubler/)
  — Daisycon/Awin BE 텔레콤 카테고리 활성

### 운영자 사전 학습 (대화 컨텍스트, 2026-05-09)
- 외부 시스템 자동 차단 경험: Reddit 광고 차단, Facebook 광고 차단 (arbitoria.com
  운영 시기). 통신사 스크래핑은 더 정교한 차단 시스템 가능성 — 본 ADR이 명시 인용.
