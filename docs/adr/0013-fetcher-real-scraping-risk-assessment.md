# ADR-0013: PLAN 1.5.6 실 스크래핑 진입 전 리스크 평가 + 분기 결정

## Status

**Accepted — 옵션 C (MEDIUM) 채택 (2026-05-10)**. 운영자 GATE-F 검토 결과
ADR §분기 권장 그대로 옵션 C 채택. 1.5.6은 페이즈 5/6 재평가 시점까지 차단
([!]) 마킹. 그동안 method='stub' 유지 + 베타는 §평가 6 옵션 X (스텁 +
"추정값")로 진행 가능.

**Amendment 1 (2026-05-17, [ADR-0034](0034-strategy-pivot-completion-first-seo-launch.md) D3)**
— **옵션 C → 진입 (차단 해제)**. 운영자 전략 피벗으로 PLAN 1.5.6 `[!]` →
`[ ]`. **MEDIUM 2.75/5.0 분류 근거는 여전히 유효** (법적 불확실 = Proximus/
Telenet GTC PDF 추출 실패 Appendix A 잔존 + 솔로 시간 비용 3.5/5 셀렉터
디버깅 sink) — 운영자 *의식적 수용* (Deferred/HIGH 재분류 아님, 근거 무효화
아님). 옵션 C 권장 → **"옵션 B 유사 진입 + 24h 신선도 모니터링 게이트 복원
+ GTC PDF 수동 열람 선행 (Appendix A §조건 A, 운영자 트랙) + Orange BE/Voo
robots.txt+TOS 신규 평가 (legal 4-provider 일괄 트리거 — Proximus/Telenet/
Orange BE/Voo, ADR-0034 D3 §legal 선행조건, PLAN 1.5.6 진입 시 호출)"** 로
대체. CJEU Ryanair 판례 적용 가능성 ↑ (organic 사용자 = 상업 신호, Appendix
A §조건 C) — 본 Amendment 가 숨기지 않음. 옵션 X 자동 비활성은 본 Amendment
1 §트리거 조건 (`rawPayload.stub === false`) 에 *이미 설계됨* — 추가 코드 0.

**Appendix B (2026-05-17, legal 에이전트)** — **4-provider robots.txt + TOS
일괄 검토 완료 (D3 선행조건)**. Proximus/Telenet/Orange BE/Voo 모두 공개 가격
페이지 robots.txt Disallow 없음. Voo TOS 텍스트 추출 완료 — 자동 수집 명시
금지 없음. Proximus/Telenet/Orange BE GTC PDF 미확인 잔존 (운영자 수동 열람
병행 트랙 — Appendix B §B.8). 판정: **1.5.6/1.5.8/1.5.9 모두 조건부 진입
가능** (🟡 — 차단 아님). Orange BE 소비자 TOS PDF 수동 열람이 1.5.8 진입의
우선순위 높은 선행조건. 외부 변호사 즉시 감사 불필요 (Appendix B §B.7
조건 A/B/C/D 미충족). 상세: [Appendix B](#appendix-b----4-provider-robotstxt--tos-검토-d3-선행조건-2026-05-17).

**격상 이력**:
- Proposed (2026-05-09) — 7 평가 + Appendix A legal 1차 검토
- Accepted 옵션 C (2026-05-10) — 운영자 결정, GATE-F 통과
- Amendment 1 (2026-05-17) — 옵션 C → 진입 (ADR-0034 D3, 운영자 의식 수용)
- Amendment 3 (2026-05-28) — 정찰 스텁 전제 붕괴 정정 (페이지 단위 하이브리드 Cheerio)
- ~~**Amendment 4 (2026-07-13, Draft)**~~ — **❌ Rejected (2026-08-16)**: Orange BE mobile "정적 파싱 가능" 주장이 raw fetch 재검증에서 반증 (근거 정찰이 WebFetch — Amendment 3 이 경고한 함정 재발). PLAN 4.24 취소. → §Amendment 4 재검증 (2026-08-16)
- **Appendix B Amendment (2026-08-19)** — Orange Love 번들 GTC 확보(WAF 해제 + 로컬 pdftotext) + 키워드 직접 금지 0건 → **PLAN 4.26.a 번들 라운드 legal 게이트 조건부 OPEN** (B.10.5 configurer URL 미요청 조건).

본 ADR은 **결정 + 권장만** 한다. 실 fetcher 코드 변경 X, fetcher 메타 변경 X,
새 의존성 X. 옵션 C 채택의 직접 후속 = PLAN 1.5.6 status 갱신 + 본문 인용
추가 (코드 0줄). 페이즈 5 진입 시점에 본 ADR 재평가 트리거 (§검증 3).

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
| Proximus | 요금제 페이지 차단 X (요청대로 fetch 가능) | Legal info 페이지에 명시 금지 *없음*. General Terms PDF 미열람. | **2** → **2** (Appendix A 갱신: PDF 파싱 실패, 명시 금지 미확인) |
| Telenet | 요금제 페이지 차단 X. `Allow: /` 관대. | Algemene voorwaarden PDF 미열람 → Appendix A: 법적정보 페이지에 *직접적 명시 금지 없음*. 단 "intellectuele eigendom 보호 + 일반 금지 사용" 조항 존재 (약함). | **2** → **2.5** (약한 강도 조항 반영, 상세는 Appendix A) |

**근거**: robots.txt가 명시 차단 안 하는 한 BE 법체계에서 *기본 허용*에 가까움
(Ius Mentis 2015). Appendix A legal 에이전트 검토 결과: Proximus General Terms PDF는
WebFetch 파싱 실패로 텍스트 추출 불가. Telenet 법적정보 HTML 페이지(juridische-informatie)
에서 일반적 금지 사용 조항 확인 (스크래핑 *직접* 언급 없음 — 약한 강도). PDF 본문
확정 검토는 외부 변호사 또는 수동 열람 필요 — 잔여 불확실성 존재.

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
| **1. 법적 리스크** (TOS + GDPR + IP reputation) | **2.5** | 0.30 | 0.75 | robots.txt 허용 + PII 부재 + IP reputation 관리 가능. Telenet HTML 법적정보 페이지에서 일반 금지 사용 조항(약한 강도) 확인. 양사 General Terms PDF 텍스트 추출 실패 — 잔여 불확실성 존재 (Appendix A). |
| **2. 기술적 리스크** (HTML 안정성 + 봇 차단) | **3.0** | 0.30 | 0.90 | Cloudflare/Akamai 보수 가정 + Telenet 리브랜딩 진행. 첫 fetch 전 검증 불가 — 운영자 사전 차단 학습이 직접 적용. |
| **3. 베타 일정 영향** | **2.0** | 0.20 | 0.40 | 옵션 X (스텁 + 베타)가 *P3 정합 + 일정 무영향*. Y만 위험. |
| **4. 솔로 사이드 시간 비용** (디버깅 부담) | **3.5** | 0.20 | 0.70 | 셀렉터 깨짐 디버깅 sink + Cheerio 학습 + 차단 시 우회 학습. FOUNDER.md 솔로 학습자 컨텍스트에서 가장 큰 미지수. |
| **종합 가중 평균** | | | **2.75** | **MEDIUM** (2.1~3.5 구간) — Appendix A 갱신 후 (2.69 → 2.75) |

### 분류: MEDIUM (2.75 / 5.0) [갱신: 2.69 → 2.75, Appendix A 법적 검토 반영]

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
  > 진행 또는 보류 분기는 [ADR-0013](0013-fetcher-real-scraping-risk-assessment.md)
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

---

## Appendix A — General Terms 본문 검토 (legal 에이전트, 2026-05-09)

### 검토 범위

**Proximus** (시도한 URL):
- `https://www.proximus.be/en/id_cr_warnland/personal/orphans/legal-information.html` — HTML 열람 성공, PDF 링크만 노출 (텍스트 본문 없음)
- `https://www.proximus.be/dam/jcr:7a6be979-b712-4e0a-8dcf-7531f1772946/GTC` — PDF WebFetch 시도: Lorem Ipsum placeholder 판정 (텍스트 추출 실패)
- `https://www.proximus.be/dam/jcr:925d1012-ee1b-439d-9449-b4c3b11567d4/cdn/sites/iportal/documents/pdfs/common/PDFS-of-Terms-and-conditions/GTC_ONE_20230101_ENG~2024-11-26-12-42-57~cache.pdf` — PDF WebFetch 시도: FlateDecode 압축 스트림, 텍스트 추출 실패
- `https://www.proximus.be/dam/jcr:64abc4aa-f00f-45a8-b95b-083408e4fa3d/gtc-internet-aup-ss-slg-en.pdf` — PDF WebFetch 시도: 압축 스트림, 텍스트 추출 실패
- `https://www.proximus.be/en/about/general-conditions` — HTTP 404
- `https://www.proximus.be/en/legal` — HTTP 404

**Telenet** (시도한 URL):
- `https://www2.telenet.be/en/customer-service/legal/` — HTTP 404
- `https://www2.telenet.be/nl/klantenservice/algemene-voorwaarden/` — HTTP 404
- `https://www2.telenet.be/fr/service-clientele/conditions-generales/` — HTTP 404
- `https://www2.telenet.be/content/dam/www-telenet-be/klantenservice/legal-auteursrechten/algemene-voorwaarden_update.pdf` — PDF WebFetch 시도: 그래픽/디자인 파일 판정, 텍스트 추출 실패
- `https://www2.telenet.be/content/dam/www-telenet-touch/nl/klantenservice/downloads-(pdf)/telenet-residentieel-algemene-voorwaarden-23maart2025.pdf.coredownload.pdf` — PDF WebFetch 시도: FlateDecode 압축, 텍스트 추출 실패 (2025-03-23 최신판)
- `https://www2.telenet.be/content/dam/www-telenet-touch/nl/klantenservice/downloads-(pdf)/algemene-voorwaarden-telenet-september-2024.pdf.coredownload.pdf` — HTTP 404
- `https://www2.telenet.be/content/dam/www-telenet-be/klantenservice/downloads/algemene_voorwaarden_res_final_01032022.pdf` — PDF WebFetch 시도: 그래픽 파일 판정, 텍스트 추출 실패
- `https://www2.telenet.be/residential/nl/klantenservice/algemeen/voorwaarden/juridische-informatie/` — **HTML 열람 성공, 텍스트 본문 추출 성공** (아래 참고)
- `https://www2.telenet.be/nl/klantenservice/wat-zijn-de-algemene-voorwaarden-van-telenet/` — HTML 인덱스 페이지만, PDF 링크 목록

**검색 키워드 (3개 언어)**:
- 영어: automated access, automated retrieval, scraping, crawling, crawl, robot, bot, spider, data extraction, systematic access, automated means, mechanical means, harvest
- 프랑스어: accès automatisé, extraction automatisée, robot, système automatisé, moyens automatisés, moyens mécaniques, données automatique, racler, racloir, exploration
- 네덜란드어: geautomatiseerde toegang, automatische extractie, robot, systematische toegang, automatische middelen, mechanische middelen, gegevensextractie, schraapen, schrapen, verkennen

### 발견 조항

#### Proximus

HTML 법적정보 페이지에서 발견된 조항 없음. 모든 약관은 PDF 링크로만 제공. 모든
Proximus General Terms PDF는 WebFetch FlateDecode 압축 스트림 문제로 텍스트 추출
실패 — 키워드 검색 불가. 따라서 **Proximus GTC PDF 내 자동 수집 명시 금지 조항
존재 여부: 확인 불가**.

#### Telenet

**HTML 페이지 (`juridische-informatie`)에서 발견된 조항** (간접적, 약한 강도):

1. **약함** "De teksten, tekeningen, foto's, films, beelden, gegevens, databanken,
   software, namen, handels- en domeinnamen, merken, logo's en andere componenten
   van de website zijn beschermd door intellectuele rechten" [+] 이를 "opslaan,
   reproduceren, wijzigen, openbaar maken, distribueren of verzenden" 금지 — 명시적
   출처: `https://www2.telenet.be/residential/nl/klantenservice/algemeen/voorwaarden/juridische-informatie/`

   - 이 조항은 웹사이트 *콘텐츠*의 저장·재배포를 금지하는 *지적재산권 조항*이지,
     *자동 접근 방법 자체*를 직접 금지하는 조항이 아님.
   - 공개 요금제 가격 정보는 "데이터베이스 보호" 적용 여부가 별도 법적 판단 필요.

2. **약함** "Het is verboden de website te gebruiken op een manier die schade
   berokkent, vervormt, onderbreekt, stopzet of minder efficiënt maakt" (웹사이트를
   손상시키거나 비효율적으로 만드는 방식으로 사용하는 것은 금지됨) — 동일 출처

   - 이 조항은 *일반 금지 사용* 조항으로, 스크래핑이 서버에 실질적 부담을 주지
     않는 한 직접 적용 논란 여지 있음. 단 1일 1회 요금제 페이지 fetch는 이 기준을
     초과할 가능성 매우 낮음.

**Telenet Algemene voorwaarden PDF (2025-03-23 최신판)**: WebFetch 텍스트 추출 실패.
*스크래핑 직접 명시 금지 조항 존재 여부: 확인 불가*. 단 검색 엔진 결과에서
Telenet 2024년 9월 약관에 대한 검색 시 "geautomatiseerde", "systematische" 키워드
매칭 없음 (메타데이터 수준 간접 확인).

### legal 에이전트 판정

- **Proximus 명시 금지 강도**: 확인 불가 (PDF 파싱 전체 실패)
- **Telenet 명시 금지 강도**: 약함 (HTML 법적정보 페이지 기준 — 직접 스크래핑 금지
  조항 부재, 지적재산권 보호 + 일반 금지 사용 조항만 확인)
- **평가 1 점수 갱신**: Proximus 2 유지 (불확실성 유지) / Telenet 2 → 2.5 (약한
  강도 조항 반영) — 평균 2.0 → 2.25
- **법적 리스크 차원 점수 갱신**: 2.3 → 2.5
- **종합 점수 영향**: 2.69 → 2.75 (가중 기여분 0.06 증가)
- **분기 권장**: **MEDIUM 유지** (2.75 — 임계값 3.6에서 0.85 차이)

HIGH 격상 요건인 "명시 금지 강도 중간 이상 발견"은 충족되지 않음. 발견된 조항은
약한 강도이며 공개 요금제 가격 스크래핑에 대한 직접 언급 없음.

### 한계

1. **PDF 파싱 전체 실패**: Proximus GTC PDF 4개, Telenet GTC PDF 4개 모두 WebFetch
   로 FlateDecode 압축 스트림 텍스트 추출 불가. 이는 legal 에이전트 가장 큰 한계.
   수동 열람(브라우저 직접 다운로드 + Ctrl+F) 또는 외부 도구(pdfminer, PDF.js)로만
   확인 가능.
2. **Wayback Machine 차단**: `web.archive.org` WebFetch 접근 불가 — 아카이브 캐시
   경로 없음.
3. **간접 확인 한계**: 검색 엔진 메타데이터 + HTML 페이지 텍스트만 확인 — 실제
   GTC PDF 본문 텍스트는 0건 확보.
4. **Telenet 리브랜딩 영향**: Liberty Global 합병 이후 일부 URL 구조 변경으로
   직접 링크 다수 404 반환 — 현행 유효 URL 특정 어려움.

### 외부 변호사 감사 권장 여부

현재 발견 수준(약한 강도 + PDF 미확인)만으로는 **외부 변호사 즉시 감사 불필요**.
단 다음 조건 중 하나 충족 시 베타 직전 €800 외부 감사 권장 (ADR-0004 §결정 3
정합):

- **조건 A**: 1.5.6 실 스크래핑 진입 전 운영자가 GTC PDF를 수동 열람해 "중간"
  강도 이상 조항 발견 시 → 즉시 legal 에이전트 재호출 + 외부 변호사 감사 검토
- **조건 B**: 실 fetch 후 Proximus/Telenet으로부터 중지 요청(cease & desist) 또는
  법적 접촉 발생 시 → 외부 변호사 즉시 호출 (ADR-0013 Amendment 필요)
- **조건 C**: 베타 진입 후 어필리에이트 수수료 발생 시 (수익 창출 시점) — CJEU
  Ryanair 판례(가격 비교 목적 스크래핑 계약 위반)가 상업적 사용에 적용 가능성 ↑

**2026-05-09 현재**: 조건 A/B/C 미충족 → 외부 변호사 감사 연기 유지.

운영자 권고 후속 작업:
1. Proximus GTC 최신판 + Telenet Algemene voorwaarden 2025년 3월 최신판을 브라우저로
   직접 열람해 Ctrl+F로 "automated", "geautomatiseerde", "scrapen", "robot" 키워드
   수동 검색 (약 30분 작업) — 가장 비용 효율적 잔여 위험 해소 방법.
2. 결과를 본 Appendix A Amendment로 추가 기록.

---

## Amendment 1 (2026-05-13) — 옵션 X "추정값" UI 위치/문구 잠금

### Context

**PLAN 1.5.6.1 신설** (architect 정찰 2026-05-13): 옵션 X(스텁 데이터로 베타 출시)의 실행 명세 미확정.

- ADR-0013:429~430 원문: "추정값 표시 위치/배치 = 페이즈 3.5 결과 페이지 진입 시 별도 결정" 유보.
- PLAN 1.5.6.1이 본 Amendment 1 역할을 함.
- 4.6 베타 배포 *전* **필수 구현** — 옵션 X UI 미표시 = 헌법 P1(정보 우선) / P3(투명성) + ADR-0029 §T2(정직성 잠금) 위반.

**architect 격상 선택**:
- 본 Amendment 1 이 **§평가 6 옵션 X 의 *결정 격상*** (유보 → 잠금).
- 옵션 A~W 본문 변경 0. 옵션 X 의 후속 구현 명세만 append.
- ADR status = **Accepted 유지** (옵션 C 채택 기반 수정 아님, 옵션 X 격상).

### Decision

#### 위치 2 — architect 잠금 확정

**1. 결과 페이지 헤더 배너** (`src/app/r/[shortId]/page.tsx` 상단)
- 신규 컴포넌트: `<BetaEstimatedBanner />`
- 배치: `<ResultConclusionCard />` **위** (결론 카드보다 위에 노출, 중요도 우선)
- 트리거: 결과의 `view.items[0]?.rawPayload?.stub === true` (현 스텁 100% 단계)
- 페이즈 5 옵션 B 진입 후: 적어도 1 row가 stub 이면 표시 (row 단위 혼재 대비)

**2. `deriveCaveats` 9번째 규칙** (`src/engine/caveats.ts`)
- 트리거: 각 row의 `tariffSnapshot.rawPayload?.stub === true`
- 기존 8 규칙 동형 톤 (추가 caveat 규칙)
- 콘텍스트: `rawPayload.stub === false` 진입 시 자동 비활성 (조건부 표시)

**거부된 후보**:
- 결과 카드 셀별 배지 — 시각 noise (카드마다 반복)
- 결론 카드 내부 인라인 — 배너와 중복 + 결론 카드 길이 증가

#### 정확 문구 잠금

**배너 문구** (scribe 결정 근거: 간결성 + ADR-0029 §T2 톤 정합):

- **제목** (알림 아이콘 + 텍스트): `⚠️ 베타 단계: 추정값`
- **본문** (1~2줄): `"가격은 운영자가 2026-05-09에 수동 검증한 추정값입니다. 실시간 가격은 페이즈 5 이후 격상 예정. 자세히: `/data-sources`"`
- **링크 대안**: `/data-sources` 또는 ADR-0013 문서 (사용자 가독 형태 선호 — ADR 기술 용어 회피)

**caveat 문구** (기존 8 규칙 동형, `src/engine/caveats.ts` 패턴 일관):

- **caveat 타입**: info (경고 대신 정보성)
- **문구**: `"이 가격은 추정값 — 실시간 데이터는 페이즈 5 이후 격상"`
- 또는 더 짧게: `"추정값 — 실 데이터 페이즈 5 이후"`

**ADR-0029 §T2 정직성 잠금 톤 일관**:
- 배너 + caveat 모두 **"솔로 신생 사이트" + "베타 = 데이터 수집 목적"** 암시
- 급박함 금지 ("지금 바로" X), 거짓 우위 금지 ("가장 저렴" X)
- 사용자 신뢰 보호 (과장 X, 정직 표기)

#### 트리거 조건 확정

- **배너**: `useMemo` 내 단순 조건: `view.items[0]?.rawPayload?.stub === true`
- **caveat**: 각 row 단위: `tariffSnapshot.rawPayload?.stub === true`
- **페이즈 5 환원**: `rawPayload.stub === false` 시 자동 비활성 (조건부 제거)

#### 스타일 + a11y

- **아이콘**: `lucide-react` `AlertTriangle` 또는 단순 ⚠️ 이모지
- **배경**: `bg-warning-soft` 또는 `bg-blue-50` (긴급성 X, 정보성)
- **텍스트**: `text-sm` + `text-fg-soft` (4.1.d 인터스티셜 톤 일관)
- **a11y**: `role="status"` (정보 공시, 긴급 알림 아님)

### Implementation guide (builder 인계)

1. **컴포넌트 신설**: `src/app/r/[shortId]/components/BetaEstimatedBanner.tsx`
   - Props: `isStub: boolean` (트리거)
   - 조건부 렌더: `{isStub && <BetaEstimatedBanner />}`
   - 배치: `<ResultConclusionCard />` 위

2. **caveat 규칙 추가**: `src/engine/caveats.ts` line ~180
   - 규칙 9: `if (tariffSnapshot.rawPayload?.stub === true) → { type: 'info', message: '추정값...' }`
   - 테스트: `caveats.test.ts`에 케이스 추가

3. **테스트 명세**:
   - `src/app/r/[shortId]/__tests__/page.test.tsx` — 배너 렌더 (stub 시 O, not stub 시 X)
   - `src/engine/__tests__/caveats.test.ts` — 규칙 9 caveat (stub 시 포함, not stub 시 제외)

### References

- **PLAN 1.5.6.1** — 본 Amendment 1 의 실행 명세 원본
- **ADR-0029 §T2** — 정직성 토큰 "솔로 신생 사이트" + "베타 = 데이터 수집" 톤 일관
- **헌법 P1 (정보 우선)** / **P3 (투명성)** — UI 미표시 = 위반
- **ADR-0013:253~263 §평가 6 옵션 X** — 본 Amendment 1 이 옵션 X 의 구현 부속 명세

#### Implementation guide 구현 완료

**구현 완료 (2026-05-13, 커밋 `a0b876c`)**: BetaEstimatedBanner.tsx RSC 신설 (amber warning bg, role="status") + .test.tsx 7 케이스. deriveCaveats 규칙 9 추가 ("추정값 — 실 데이터 페이즈 5 이후") + caveats.test.ts 10 케이스. comparison.ts SQL COALESCE isStub propagation. page.tsx 조건부 노출. typecheck/lint/test 477 passed / harness:plan 54 정합 / harness:data 통과. **4.6 베타 배포 의존성 해소**.

---

## Appendix B — 4-provider robots.txt + TOS 검토 (D3 선행조건, 2026-05-17)

**검토 목적**: ADR-0034 D3 §legal 선행조건 + PLAN 1.5.6/1.5.8/1.5.9 선행조건 해소.
Proximus/Telenet/Orange BE/Voo 4개 벨기에 통신사 공개 가격 페이지 스크래핑에 대한
1차 법무 검토. **실행 주체: legal 에이전트 (1차 검토)**, 외부 변호사 아님.

**검토일**: 2026-05-17 (UTC)

**데이터 수집 방식**: WebFetch(robots.txt 직접 fetch) + WebFetch(TOS/법적정보 HTML 페이지)
+ WebSearch(TOS/GTC 키워드 검색). 모든 주장에 source_url + fetched_at 명시 (헌법 P1).

**검토 범위**: 공개 요금제/가격 페이지 스크래핑 목적 (1일 1회 fetch, PII 0, 공개 데이터).
GDPR = 적용 없음 (개인정보 0). 검토 대상 = robots.txt + 웹사이트 이용약관(TOS/GTC의
웹사이트 이용 조항). 가입자 서비스 약관(인터넷 서비스 AUP 등)은 스코프 다름.

---

### B.1 Proximus — 재확인 (Appendix A 갱신)

**robots.txt**

- source_url: `https://www.proximus.be/robots.txt`
- fetched_at: 2026-05-17T UTC (WebFetch 직접 확인)
- 전문 (변경 없음 — Appendix A 2026-05-09 버전과 동일):

```
User-agent: *
Sitemap: http://www.proximus.be/sitemap.xml
Disallow: /cgi-bin/
Disallow: /web/
Disallow: /GSA/
Disallow: /home/gallery/content/
Disallow: /private/gallery/content/
Disallow: /companies/gallery/content/
Disallow: /dam/cdn/sites/iportal/documents/pdfs/
Disallow: /dam/*/cdn/sites/iportal/documents/pdfs/
Disallow: /dms/cdn/sites/iportal/documents/pdfs/
Disallow: /dms/*/cdn/sites/iportal/documents/pdfs/
Disallow: /epp/
Disallow: /dam/cdn/sites/support/documents
Disallow: /dam/*/cdn/sites/support/documents
Disallow: /dms/cdn/sites/support/documents
Disallow: /dms/*/cdn/sites/support/documents
Disallow: /en/id_km-*
Disallow: /fr/id_km-*
Disallow: /nl/id_km-*
Disallow: /formbuilder/
Disallow: /logout
Disallow: /api/
Disallow: /rest/
Disallow: /media/main/$
Disallow: /media/smartphones/$
```

- Crawl-delay: **없음**
- 가격 페이지 경로 (`/en/personal/products/mobile/...`, `/en/personal/products/internet/...`):
  **명시 Disallow 없음**. Sitemap 등록 (크롤러 친화).
- Appendix A 대비 변경: `/web/` → `/web/`, `/api/` → `/api/` (동일). `/GSA/` 추가 확인.
  변경 사항 없음 — Appendix A 결론 유지.

**TOS/GTC**

- Appendix A 결론 유지: Proximus 법적정보 HTML 페이지에서 자동 접근 명시 금지 조항
  부재. General Terms PDF (GTC) 4종 모두 WebFetch 텍스트 추출 실패 (FlateDecode 압축).
- 수동 열람 요청 조건(Appendix A §조건 A) = 운영자 병행 트랙 (본 Appendix B 완료 후
  30분 작업).

**판정**: 🟡 조건부 (조건 = B.5 공통 조건 + 운영자 GTC 수동 열람 선행)

---

### B.2 Telenet — 재확인 (Appendix A 갱신)

**robots.txt**

- source_url: `https://www2.telenet.be/robots.txt`
- fetched_at: 2026-05-17T UTC (WebFetch 직접 확인)
- 전문:

```
User-Agent: *
Allow: /
Disallow: */jcr:content/*
Disallow: */etc/*
Allow: /etc/*.js
Allow: /etc/*.css

Sitemap: https://www2.telenet.be/sitemap.xml
Sitemap: https://www2.telenet.be/residential/sitemap.xml
Sitemap: https://www2.telenet.be/business/sitemap.xml
Sitemap: https://www2.telenet.be/corporate/sitemap.xml
```

- Crawl-delay: **없음**
- 가격 페이지 경로 (`/residential/en/products/...`): 최상단 `Allow: /` + 명시 Disallow
  없음. Sitemap 4개 등록 (residential 포함). **가장 관대한 robots.txt**.
- Appendix A 대비 변경 없음.

**TOS/GTC**

- Appendix A 결론 유지:
  - HTML `juridische-informatie` 페이지에서 발견된 조항 (약한 강도):
    1. 지적재산권 보호 조항: "teksten, tekeningen, foto's, films, beelden, gegevens,
       databanken...beschermd door intellectuele rechten" — 저장·재배포 금지. 단
       *자동 접근 방법 자체* 직접 금지 아님.
    2. 일반 금지 사용 조항: "verboden de website te gebruiken op een manier die schade
       berokkent, vervormt, onderbreekt..." — 일 1회 요금제 fetch는 이 기준 초과 가능성
       매우 낮음.
  - Telenet Algemene voorwaarden PDF (2025-03-23 최신판): 텍스트 추출 실패. 확인 불가.
- 수동 열람 요청 조건 = 운영자 병행 트랙.

**판정**: 🟡 조건부 (조건 = B.5 공통 조건 + 운영자 GTC 수동 열람 선행)

---

### B.3 Orange BE — 신규 검토 (ADR-0013 미검토 → 완료)

**robots.txt**

- source_url: `https://www.orange.be/robots.txt`
- fetched_at: 2026-05-17T UTC (WebFetch 직접 확인)
- 전문 (핵심 발췌 — Drupal 기반 표준 robots.txt):

```
User-agent: *
Allow: /core/*.css$
Allow: /core/*.js$
[... CSS/JS/images Allow 패턴 ...]
Disallow: /core/
Disallow: /profiles/
Disallow: /README.txt
Disallow: /web.config
Disallow: /admin/
Disallow: /comment/reply/
Disallow: /filter/tips
Disallow: /node/add/
Disallow: /search/
Disallow: /user/register/
Disallow: /user/password/
Disallow: /user/login/
Disallow: /user/logout/
Disallow: /index.php/admin/
[... /index.php/* 미러 ...]
Disallow: /*brand=
Disallow: /*category_product_type=
Disallow: /*connectivity=
Disallow: /*filter_color=
Disallow: /*filter_special_offer=
Disallow: /*memory=
Disallow: /*sp=
Disallow: /*internet=
Disallow: /*mobile=
Disallow: /*option=
Disallow: /*promocode=
Disallow: /*tp=
Disallow: /*filters
Disallow: /*topic
Disallow: /*m&tvm=
Disallow: /*option-
Disallow: /nl/opties-en-diensten/gsm-en-smartphone/online-instellen/*
Disallow: /fr/options-et-services/gsm-et-smartphone/configuration-en-ligne/*
```

- Crawl-delay: **없음**
- Sitemap: **명시 없음** (Drupal 기본 robots.txt — Sitemap 항목 미포함)

**가격 페이지 경로 Disallow 분석 (핵심)**:

| 차단 경로 | 우리 스크래핑 대상 경로 | 충돌 여부 |
|---|---|---|
| `/admin/` | `/fr/produits-et-services/internet-chez-vous` | **없음** |
| `/*internet=` (쿼리 파라미터) | 경로 자체 (`/fr/produits-et-services/internet`) | **없음** (`/*internet=`은 `?internet=` 쿼리 파라미터만 — 경로 아님) |
| `/*mobile=` | 동일 | **없음** |
| `/*filters` | 동일 | **없음** |
| `/fr/.../configuration-en-ligne/*` | 가격 페이지 (`/fr/produits-et-services/mobile`) | **없음** |

확인된 공개 가격 페이지 (WebFetch 직접 확인, 2026-05-17):
- `https://www.orange.be/fr/produits-et-services/mobile` — 공개, 가격 표시, 인증 없음
- `https://www.orange.be/fr/produits-et-services/internet-chez-vous` — 공개, 가격 표시
  (Start €43/월, Zen €53/월, Giga €62/월 등)

**결론**: 공개 가격 페이지 경로는 Disallow 대상이 **아님**. 쿼리 파라미터 `?internet=`,
`?mobile=` 사용 시 차단되므로 경로 직접 fetch 방식 유지 필요.

**TOS/GTC — Orange BE 법적정보 검토**

1. **corporate.orange.be/en/legal-information** (source_url, fetched_at 2026-05-17):
   - HTML 구조만 노출. 실제 약관 링크가 FR/NL 별도 페이지로 분리됨. 직접 클로즈 텍스트
     추출 불가.

2. **orange-business.com/en/legal-information** (source_url, fetched_at 2026-05-17):
   Orange 그룹 공통 법적정보 페이지. 확인된 조항 (영문 원문):

   **지적재산권 조항**:
   > "Orange informs users of this site that most of the information and data contained
   > herein are protected by legal provisions relating to intellectual property rights."

   **무단 재현 금지 조항**:
   > "Any representation, reproduction, use, adaptation, or modification in whole or in
   > part, as well as any exploitation, even partial, of this information and data is
   > prohibited without...prior permission of Orange."

   **개인 사용 제한 조항**:
   > "The use of this site is reserved for the user's strictly personal use. Any
   > reproduction or representation...for any other purpose...is prohibited without
   > express...permission of Orange."

   - **자동 접근/스크래핑 명시 금지**: 확인되지 않음 (직접 언급 없음).
   - "strictly personal use" 조항: 상업적 비교 사이트의 자동 가격 수집이 이 조항의
     "personal use" 위반 가능성이 있음. 단 이 조항은 orange.com 그룹 차원 (비즈니스
     포털)이며 orange.be 소비자 사이트의 동일 적용 여부는 별도 확인 필요.
   - 웹사이트 TOS가 아닌 **이용 조건(Conditions Générales d'Abonnement)**을 검토해야
     하나, orange.be 소비자 약관 PDF는 텍스트 추출 불가 상태.

3. **주요 관찰**: Orange BE robots.txt가 Drupal 표준 템플릿임 — 비교 목적 스크래핑
   경로를 명시 차단하지 않는다. 단 "strictly personal use" 조항이 그룹 차원 TOS에
   존재하며 orange.be 소비자 사이트 TOS PDF 미확인 상태가 법적 불확실성의 핵심.

**판정**: 🟡 조건부 (강도 = Proximus/Telenet보다 약간 높음 — "strictly personal use"
조항 그룹 TOS 존재 확인 + orange.be 소비자 TOS PDF 미확인 = 조건 B.5 + 추가 조건 명시)

---

### B.4 Voo — 신규 검토 (ADR-0013 미검토 → 완료)

**robots.txt**

- source_url: `https://www.voo.be/robots.txt`
- fetched_at: 2026-05-17T UTC (WebFetch 직접 확인)
- 전문:

```
User-agent: *

Sitemap: https://www.voo.be/sitemap.xml
```

- Crawl-delay: **없음**
- Disallow: **단 하나도 없음**
- Sitemap 등록: 있음

**결론**: 4개 provider 중 **가장 관대한 robots.txt**. 어떤 경로도 Disallow 없음.
`voo.be/fr/internet`, `voo.be/fr/tarifs/internet` 등 가격 페이지 경로 차단 전무.

확인된 공개 가격 페이지 (WebFetch 직접 확인, 2026-05-17):
- `https://www.voo.be/fr/internet` — 공개 접근 확인 (NET Super Relax 200Mbps,
  NET Giga Max 1Gbps 플랜 표시). 실제 가격은 동적 로딩 (`/fr/tarifs/internet`에 별도 로드).
- 주의: 가격 그리드가 JavaScript 동적 렌더링 가능성 → Cheerio 단순 fetch로 추출
  불가 시 fetcher 구현 복잡도 ↑ (단 이는 법적 리스크 아닌 기술 리스크).

**TOS/GTC — Voo 법적정보 검토**

1. **voo.be/fr/conditions-generales** (source_url, fetched_at 2026-05-17):
   - 서비스 약관 (2024년 11월 1일 발효 버전) 텍스트 추출 성공.
   - **자동 접근/스크래핑 명시 금지**: **없음**. 확인 완료.
   - 지적재산권 조항 (Art. 16.1): 방송 프로그램 콘텐츠 보호 조항 — 요금제 가격 데이터에
     직접 적용 불가.
   - 일반 사용 제한 (Art. 17.2): "서비스 및 콘텐츠는 배타적으로 사적·개인적 사용 목적"
     — 가입자의 VOO 인터넷 *사용* 정책이며 웹사이트 방문자의 데이터 수집에 적용되는
     조항이 아님.
   - 데이터베이스 보호: 특정 조항 없음.
   - 가격 정보: Art. 7.1에서 "Details of its current pricing...can be found [here]" —
     공개 가격 정보이며 추출 금지 조항 없음.

2. **voo.be/fr/vie-privee** (Privacy Policy, source_url, fetched_at 2026-05-17):
   - 자동 접근/스크래핑 조항: 없음.
   - 웹사이트 IP 보호: "Copyright © 2025 VOO. Tous droits réservés." 일반 저작권 표시만.
   - 데이터베이스 보호: 없음.

3. **voo.be/fr/mentions-legales** (법적 고지): HTTP 404 — 별도 법적 고지 페이지 없음.

**결론**: Voo TOS/GTC에서 웹사이트 자동 접근 또는 가격 데이터 추출을 **명시 금지하는
조항을 발견하지 못했음** (텍스트 추출 성공, 키워드 검색 완료). Voo는 4개 provider 중
TOS 법적 리스크가 가장 낮음.

**판정**: 🟡 조건부 (조건 = B.5 공통 조건. GTC 수동 열람 추가 권고 수준이나 필수는 아님
— TOS HTML 텍스트 추출 성공하여 키워드 검색 완료)

---

### B.5 4-provider 종합 판정 표

| Provider | robots.txt 가격 페이지 차단 | TOS 자동 수집 명시 금지 | 평가 점수 (1=낮은리스크) | 판정 |
|---|---|---|---|---|
| **Proximus** | 없음 (Appendix A 재확인) | 확인 불가 (GTC PDF 추출 실패) | **2.0** | 🟡 조건부 |
| **Telenet** | 없음 (Allow: / 관대) | 약한 강도 (지적재산권 + 일반금지 조항, GTC PDF 미확인) | **2.5** | 🟡 조건부 |
| **Orange BE** | 없음 (쿼리 파라미터만 차단, 경로 차단 없음) | 미확인 (그룹 TOS "strictly personal use" 확인, orange.be 소비자 TOS PDF 미확인) | **2.5** | 🟡 조건부 |
| **Voo** | 없음 (Disallow 전무 — 가장 관대) | 없음 (TOS 텍스트 추출 성공, 키워드 검색 완료) | **1.5** | 🟡 조건부 |

**공통 조건 (B.5 공통)**:
1. 일 1회 이하 fetch (서버 부담 최소화 — Telenet "schade berokkent" 조항 위반 가능성 배제)
2. 정직한 User-Agent 명시 (Slim/1.0 + 도메인 referrer — P3 정합)
3. 요금제 경로 직접 fetch (쿼리 파라미터 `?internet=`, `?mobile=` 등 사용 금지 — Orange
   BE robots.txt 쿼리 파라미터 차단 준수)
4. Robots.txt 변경 모니터링 (월 1회 자동 확인 권장)
5. 결과 페이지 `/legal/affiliate-disclosure` 에 스크래핑 출처 + 가격 기준일 표기 (P3)
6. HTTP 403/429/챌린지 발생 시 즉시 비활성 + ADR-0013 Amendment 트리거 (ADR-0034
   §회귀 #1 — 이미 설계됨)

**Orange BE 추가 조건**:
- orange.be 소비자 약관 PDF (GTC — 운영자 수동 열람 필수, B.6 체크리스트 참조)
- "strictly personal use" 조항이 orange.be 소비자 TOS에도 동일하게 존재하는지 확인
  (현재 확인 경로: orange-business.com 그룹 포털만 — 소비자 포털 별도 확인 필요)

---

### B.6 법적 리스크 프레임워크 — 3층 분석

#### EU Database Directive (96/9/EC) — Sui Generis 권리

공개 요금제 가격 데이터에 대한 sui generis 데이터베이스 권리 주장 가능성:

- **조건**: 데이터베이스 구축에 "상당한 투자(substantial investment)" 필요. Proximus/
  Telenet/Orange BE/Voo의 요금제 가격표는 기획 비용이 있으나 "데이터베이스 구축" 목적의
  독립 투자로 보기 어려움 — 핵심 사업 활동의 파생물.
- **CJEU Football Dataco (C-604/10, 2012)**: 창작적 선택 없는 단순 데이터 수집은 DB
  directive 범위 축소. 가격표는 창작적 선택 최소 → DB 저작권 적용 어려움.
- **Innoweb (C-202/12, 2013)**: 전체 데이터베이스 병렬 추출(spin-off)은 sui generis
  위반. **Slim의 패턴은 1일 1회 공개 페이지에서 현재 가격만 추출** — 전체 DB 추출이
  아님. "Re-utilization of a substantial part" 기준 미달 가능성 높음.
- **리스크 수준**: **낮음** — 1일 1회 비교 목적 가격 추출은 sui generis 침해의 "상당
  부분 추출" 요건 충족 어려움. 단 4 provider × 일 1회 × 장기 축적 시 재판단 필요.

#### CJEU Ryanair v PR Aviation (C-30/14, 2015) — 계약 제한 가능성

- **판결 요지**: 가격비교 사이트의 스크래핑은 TOS(이용약관)에 의해 계약적으로 제한 가능.
  DB directive가 적용되지 않는 경우에도 계약으로 금지 가능.
- **Slim의 노출**: ADR-0013 Appendix A §조건 C 이미 명시 — organic 사용자 = 상업 운영
  신호 = CJEU Ryanair 판례 적용 가능성 ↑. Ryanair v PR Aviation 맥락에서 핵심은
  **TOS에 스크래핑 금지 조항이 명시되어 있는가**.
- **4 provider 현황**:
  - Proximus: GTC PDF 미확인 → 명시 금지 존재 여부 불확실
  - Telenet: 약한 강도 일반 조항만 (명시 금지 아님)
  - Orange BE: "strictly personal use" 그룹 TOS 확인 (소비자 TOS PDF 미확인) → **중간
    강도** — Ryanair 판례의 계약 제한 근거로 원용될 가능성 존재
  - Voo: 명시 금지 없음 (TOS 텍스트 추출 완료)

- **Orange BE의 "strictly personal use" 조항 리스크**: 이 조항이 소비자 TOS에 동일하게
  존재한다면 Ryanair v PR Aviation 논리로 상업적 비교 사이트의 자동 가격 수집이 계약
  위반 주장의 근거가 될 수 있음. **이것이 본 검토의 핵심 미결 리스크**.

#### 벨기에 불공정경쟁 — Code de droit économique (CDE)

- CDE Art. VI.99: 비교 사이트 순위 기준 공개 의무 (헌법 P3 + ADR 설계로 이미 대응).
- 스크래핑 자체에 대한 불공정경쟁 적용: 벨기에 법체계에서 TOS 위반 스크래핑을 불공정경쟁
  으로 추가 주장하는 사례 있음. 단 TOS 명시 금지 조항 없는 경우 근거 약함.
- **Slim의 현황**: CDE 대응 (순위 공개 P3)은 이미 설계됨. 스크래핑 금지 TOS 조항
  미확인 상태에서 불공정경쟁 리스크는 낮음.

---

### B.7 외부 변호사 감사 필요 항목 분리

#### 1차 legal 에이전트로 Clear 되는 항목

- Proximus robots.txt: 가격 페이지 차단 없음 → 진행 가능
- Telenet robots.txt: `Allow: /` 관대 → 진행 가능
- Orange BE robots.txt: 가격 경로 Disallow 없음 → 진행 가능 (쿼리 파라미터 주의)
- Voo robots.txt: Disallow 전무 → 진행 가능
- Voo TOS: 자동 수집 명시 금지 없음 (텍스트 추출 완료) → 진행 가능
- Telenet TOS HTML: 약한 강도 조항만, 직접 명시 없음 → 조건부 진행 가능
- EU Sui Generis DB 권리: 1일 1회 비교 목적 = 낮은 리스크 → 자체 판단 가능

#### 외부 변호사 감사가 필요한 항목 (ADR-0004 §결정 3 §조건 B/C 트리거)

현재 시점: **외부 변호사 즉시 감사 불필요** — 아래 조건 중 하나 충족 시 ADR-0004
§결정 3 재평가:

1. **조건 A (운영자 수동 열람 트리거)**: 운영자가 GTC PDF를 직접 열람하여 Proximus/
   Telenet/Orange BE의 GTC에서 "automated", "geautomatiseerde", "automatisé",
   "scrapen", "robot" 키워드로 **중간 강도 이상** 명시 금지 조항 발견 시 → 즉시
   legal 에이전트 재호출 + 외부 변호사 감사 검토 ($800/1주, ADR-0004)
2. **조건 B (Ryanair 리스크 구체화)**: Orange BE 소비자 TOS PDF에서 "strictly
   personal use" 수준 이상의 자동화 접근 금지 조항이 발견될 경우 → CJEU Ryanair
   v PR Aviation 적용 가능성 = 외부 변호사 필수
3. **조건 C (상업 운영 신호 확인)**: 어필리에이트 수수료 발생(수익 창출) 시점 →
   상업적 스크래핑으로 Ryanair 리스크 ↑ → 베타 직전 €800 1회 감사 권장 (ADR-0013
   Appendix A §조건 C 동일)
4. **조건 D (법적 접촉 발생)**: 4개 provider 중 1개라도 cease & desist 또는 법적
   접촉 발생 시 → 외부 변호사 즉시 (ADR-0034 §회귀 #5 동일)

---

### B.8 운영자 GTC 수동 열람 체크리스트

ADR-0013 Appendix A §조건 A 의 운영자 트랙. Appendix B legal 검토 통과 후 병행 작업
(약 45분). **순서대로 실행하고 결과를 Appendix B Amendment로 기록**.

#### Proximus GTC 수동 열람

1. `https://www.proximus.be/en/id_cr_warnland/personal/orphans/legal-information.html`
   접속 → 하단 "General Terms and Conditions" 링크 클릭 → PDF 다운로드
2. 대안: Google 검색 `proximus.be GTC 2025 general terms conditions pdf download`
3. PDF Ctrl+F 검색 키워드 순서:
   - 영어: "automated", "scraping", "crawling", "robot", "bot", "systematic", "harvest"
   - 네덜란드어: "geautomatiseerde", "systematische", "robot", "schrapen", "verkennen"
   - 프랑스어: "automatisé", "extraction", "robot", "systématique"
4. 발견 시: 조항 번호 + 원문 기록 → legal 에이전트 재호출
5. 미발견 시: Appendix B Amendment에 "GTC 수동 열람 완료, 자동 접근 명시 금지 없음" 기록

#### Telenet Algemene voorwaarden 수동 열람

1. `https://www2.telenet.be/nl/klantenservice/wat-zijn-de-algemene-voorwaarden-van-telenet/`
   접속 → 2025년 3월 최신판 PDF 다운로드
2. 대안: Telenet 웹사이트 검색 "algemene voorwaarden 2025"
3. PDF Ctrl+F 검색 키워드:
   - 네덜란드어: "geautomatiseerde", "systematische toegang", "robot", "schrapen",
     "automatisch", "scrapen"
   - 추가: "website gebruik", "verboden gebruik"
4. 발견 시: 조항 번호 + 원문 기록 → legal 에이전트 재호출
5. 미발견 시: Appendix B Amendment에 기록

#### Orange BE 소비자 TOS PDF 수동 열람 (우선순위 높음)

1. `https://www.orange.be/fr/conditions-generales` 접속 →
   "Conditions générales de vente" 또는 "Conditions générales – Abonnements" PDF 다운로드
2. 대안: Google 검색 `orange.be "conditions générales" résidentiels 2024 2025 pdf`
3. PDF Ctrl+F 검색 키워드:
   - 프랑스어: "utilisation strictement personnelle", "automatisé", "robot", "scraping",
     "extraction automatique", "utilisation commerciale"
   - 네덜란드어: "strikt persoonlijk gebruik", "geautomatiseerde", "robot"
   - 특별 주의: "strictly personal use" 또는 "utilisation strictement personnelle"
     조항 — 상업적 비교 사이트 적용 여부 판단 핵심
4. **이 항목은 Orange BE fetcher (1.5.8) 진입 전 필수** (조건 B 트리거 — B.7 참조)
5. 발견 시: 조항 강도 판정 (약함/중간/강함) + 즉시 legal 에이전트 재호출

#### Voo GTC PDF 수동 열람 (낮은 우선순위 — TOS HTML 이미 검토됨)

1. `https://www.voo.be/fr/conditions-generales` HTML 버전이 이미 검토됨 (자동 수집
   금지 없음 확인). PDF 별도 버전 존재 시에만 추가 확인.
2. 검색 키워드: "automatisé", "robot", "extraction", "scraping"
3. Voo는 이미 낮은 리스크 판정 — 수동 열람 우선순위 최하위.

---

### B.9 D3 선행조건 진입 가부 — 요약 판정

**전제**: 본 Appendix B = ADR-0034 D3 §legal 선행조건의 1차 검토.

| PLAN 항목 | 대상 Provider | 판정 | 조건 |
|---|---|---|---|
| **1.5.6** (Proximus + Telenet 실 스크래핑) | Proximus, Telenet | 🟡 **조건부 진입 가능** | B.5 공통 조건 + 운영자 Proximus/Telenet GTC 수동 열람 선행 (B.8) |
| **1.5.8** (Orange BE fetcher) | Orange BE | 🟡 **조건부 진입 가능** | B.5 공통 조건 + 운영자 Orange BE 소비자 TOS PDF 수동 열람 필수 선행 (B.8 — 우선순위 높음) + "strictly personal use" 조항 소비자 TOS 미존재 확인 |
| **1.5.9** (Voo fetcher) | Voo | 🟡 **조건부 진입 가능** | B.5 공통 조건 (TOS 검토 완료, GTC PDF 수동 열람은 선택적) |

**최종 판정 근거**:
- 4개 provider 모두 robots.txt 기준 공개 가격 페이지를 Disallow하지 않음.
- 4개 provider 모두 TOS/GTC에서 자동 접근을 **명시적·직접적으로 금지하는 조항을
  확인하지 못함** (Orange BE 그룹 "strictly personal use" 조항은 간접적 리스크이며
  소비자 TOS PDF 미확인 상태).
- Voo는 TOS HTML 추출 완료 — 금지 조항 없음. 4개 중 가장 낮은 리스크.
- 즉시 외부 변호사 감사 불필요. 단 Orange BE 소비자 TOS PDF 미확인은 잔여 불확실성.

**차단 조건 (이 중 하나 충족 시 코드 머지 금지)**:
- 운영자 GTC 수동 열람에서 "중간 강도 이상" 자동 접근 금지 조항 발견
- Orange BE 소비자 TOS에서 "strictly personal use" 조항이 확인되고 비교 사이트 적용
  가능 판단이 legal 에이전트 1차 재검토에서 "중간 강도 이상"으로 격상될 경우
- ADR-0034 §회귀 #5 조건 (cease & desist)

---

**Appendix B 작성: legal 에이전트 (2026-05-17)**
**다음 단계**: 운영자 B.8 GTC 수동 열람 병행 트랙 → 결과 Appendix B Amendment로 기록.
1.5.6 fetcher 코드: 본 Appendix B 통과 + 운영자 GTC 수동 열람 완료 후 builder 진입.

---

## Appendix B Amendment (2026-05-28) — 운영자 GTC 수동 열람 완료 (Proximus/Telenet)

**실행 주체**: legal 에이전트 (1차 검토). 변호사 아님.

**검토 대상**: Proximus + Telenet 2사 (Orange BE = 1.5.8 별건, 이하 §잔여 조건 참조).

**기존 Appendix B 본문**: 변경 없음. 본 Amendment는 B.8 체크리스트 실행 결과를 append한다.

---

### 검토 방식

Appendix A (2026-05-09) + Appendix B (2026-05-17) 에서 WebFetch + FlateDecode 압축으로
텍스트 추출에 전부 실패했던 기술 장벽을, 이번 턴에서 운영자가 브라우저로 직접 PDF를 다운로드한 후
로컬 `pdftotext`(poppler) 도구로 텍스트 추출하는 방식으로 극복했다.

- **Proximus GTC** ("General terms and conditions for consumers and small enterprises", 영문,
  170줄): 로컬 추출 완료. 검토 파일: `C:\Users\kimwo\gtc-review\proximus.txt`.
  버전 표기: "1 of January 2025". 발행사: Proximus SA, VAT: BE 0202.239.951.
- **Telenet Algemene voorwaarden** (네덜란드어, 2025-03-23 최신판, 317줄): 로컬 추출 완료.
  검토 파일: `C:\Users\kimwo\gtc-review\telenet.txt`. 버전 표기: "Laatste update: 23 maart 2025".
  발행사: Telenet BV, BTW BE0473.416.418.

두 파일 모두 이번 턴에서 `Read` 도구로 직접 확인하여 키워드 검색 결과를 대조했다.
이하 조항 분류 및 판정은 **원문 직접 확인 기반**이다 (인용 아님).

---

### 키워드 검색 결과 — 0건

B.8 체크리스트 3개 언어 키워드를 두 파일 전문에서 검색한 결과:

자동 접근/스크래핑을 **직접 금지**하는 조항: **0건** (Proximus + Telenet 양사 모두).

매칭된 항목은 전부 다음 3개 유형 중 하나로, 공개 가격 페이지 스크래핑과 무관하다:

| 파일 | 매칭 문구 | 실제 스코프 | 판정 |
|---|---|---|---|
| Proximus Art. 3.2 | "automatically renewed" | 계약 자동갱신 조항 | false positive |
| Proximus Art. 8.1~8.3 | "intellectual property rights on the Products and Services...trademarks" | 제품/장비/상표 IP 조항 — 웹사이트 가격 데이터 스크래핑 언급 없음 | 스코프 밖 |
| Telenet Art. 4.4 | "automatisch verlengd" | 계약 자동갱신 조항 | false positive |
| Telenet Bijz. Vaste Telefonie 3.1 | "automatische internationale gesprekken" | 자동 국제통화 과금 조항 | false positive |
| Telenet Bijz. Televisie Art. 5 | "intellectuele eigendom op de Telenet Televisie-dienst en de audio- en audiovisuele inhoud" | TV 서비스/방송 콘텐츠 IP 조항 | 스코프 밖 |
| Telenet Bijz. Internet 1.1 | "oneigenlijk gebruik" (부적절 사용) | Telenet **네트워크** 남용(바이러스/스팸/침입) 가입자 AUP — 웹사이트 방문자 스크래핑과 다른 스코프 | 스코프 밖 |
| Telenet Bijz. Huur Toestel 2.6 | "oneigenlijk...gebruik van het Toestel" | 임대 **셋톱박스 장비** 오용 조항 | 스코프 밖 |
| Telenet Art. 12.2.1 | "centrale nummerdatabank" | 전화번호부 DB 조항 | 스코프 밖 |
| Telenet Bijz. Internet 1.2.1 | "WHOIS-databanken" | 인터넷 남용 신고 절차 내 IP 소유자 확인 안내 | 스코프 밖 |

---

### 조항 강도 판정 — ADR-0013 §B.7 프레임워크 적용

#### Proximus

검토 범위: `C:\Users\kimwo\gtc-review\proximus.txt` 전문 (170줄, 직접 확인).

Art. 8 (Intellectual rights):
> "All intellectual property rights on the Products and Services (including all documents
> created by Proximus under the Contract) as well as all trademarks, service marks, trading
> names, logos and other words or symbols...shall remain the exclusive property of Proximus...
> The Customer may not claim any rights in such intellectual property."

이 조항은 **가입자-Proximus 간 계약 맥락**의 제품·장비·상표 IP 조항이다. 적용 당사자는
Proximus 서비스 가입자("Customer")이며, 웹사이트 방문자 또는 제3자의 공개 페이지 접근을
규율하는 조항이 아니다. 공개 요금제 가격 데이터 수집을 언급하지 않는다.

CJEU Ryanair v PR Aviation (C-30/14) 관점: 계약 제한이 유효하려면 TOS가 스크래핑 대상
당사자(여기서는 Slim)에게 *적용되는* 약관이어야 한다. Proximus GTC는 Proximus 서비스
**가입자** 약관이다. Slim은 Proximus 가입자가 아니라 공개 웹사이트 방문자이므로, 이 GTC가
Slim의 스크래핑 행위에 계약적으로 구속력을 갖는다는 법적 근거가 없다.

EU Database Directive 96/9/EC Sui Generis 관점: Proximus 요금제 가격표는 가입자 약관의
일부로 공개 게시되며("Price list: All tariffs and prices...as published on its website"),
독립적 DB 구축 투자 목적의 창작물로 볼 근거가 약하다 (Football Dataco C-604/10 축소
해석). Slim의 1일 1회 현재 가격 추출은 "substantial part re-utilization" 기준 미달
가능성이 높다 (Innoweb C-202/12).

**Proximus 강도 판정: 약함 (WEAK)** — 가입자 서비스 약관 내 IP 조항이 존재하나 웹사이트
방문자의 공개 가격 페이지 스크래핑에 직접 적용되는 명시 금지 조항 없음. §B.9 차단 조건
"중간 강도 이상" 미충족.

#### Telenet

검토 범위: `C:\Users\kimwo\gtc-review\telenet.txt` 전문 (317줄, 직접 확인).

Appendix B (2026-05-17)에서 HTML `juridische-informatie` 페이지 기반으로 판정된 "약한
강도 (2.5)" 결론이 GTC PDF 직접 확인을 통해 **재확인·유지**된다.

GTC PDF 전문에서 추가로 확인된 주요 조항:

- **Art. 6.1~6.4** (Verplichtingen van de Klant): 서비스를 합법적 목적으로만 사용할 것,
  콘텐츠를 제3자에게 재배포·판매·임대 금지 — 적용 당사자는 Telenet 서비스 **가입자**.
  웹사이트 방문자 스크래핑 언급 없음.
- **Art. 6.3 원문**: "U mag deze diensten noch de inhoud ervan, kosteloos noch ten bezwarende
  titel verspreiden, commercialiseren, verkopen..." — 이는 Telenet **서비스 콘텐츠**(TV,
  인터넷 서비스)의 재배포 금지이며 공개 요금제 가격 페이지 접근과 무관하다.
- **Bijzondere voorwaarden Internet 1.1~1.2**: Telenet 네트워크 남용(바이러스, 스팸,
  침입 등) 금지 — 가입자 AUP로, 웹사이트 방문자 스크래핑 스코프와 다르다.
- **Bijzondere voorwaarden Televisie Art. 5**: TV 서비스/방송 콘텐츠 IP — 요금제 가격
  데이터와 무관.

CJEU Ryanair v PR Aviation 관점: Proximus 동일 분석 적용. Telenet GTC는 Telenet 서비스
**가입자** 약관이며, Slim은 가입자가 아니다.

**Telenet 강도 판정: 약함 (WEAK)** — Appendix B 2.5점 결론을 GTC PDF 직접 확인으로
재확인. 가입자 대상 서비스 이용 금지 조항 + TV 콘텐츠 IP 조항 존재하나 웹사이트 방문자의
공개 가격 페이지 스크래핑에 직접 적용되는 명시 금지 조항 없음. §B.9 차단 조건
"중간 강도 이상" 미충족.

---

### §B.9 차단 조건 가부 판정

**Proximus 차단 조건 충족 여부**: 미충족.
- "중간 강도 이상 자동접근 금지 조항 발견" → 해당 조항 없음. 차단 조건 미충족.

**Telenet 차단 조건 충족 여부**: 미충족.
- Appendix B 2026-05-17의 약한 강도 판정 유지. 차단 조건 미충족.

**결론: 1.5.6 코드 머지 게이트 — OPEN**.

Proximus + Telenet GTC 수동 열람 완료 결과, §B.9 차단 조건(중간 강도 이상 자동접근 금지
조항 발견)을 충족하는 조항이 발견되지 않았다. B.5 공통 조건(일 1회 이하 fetch, 정직한
User-Agent, 요금제 경로 직접 fetch, robots.txt 모니터링, /legal/affiliate-disclosure
출처 표기, 차단 발생 시 즉시 비활성)을 준수하는 것을 전제로 1.5.6 fetcher 코드 머지를
차단하지 않는다.

---

### 외부 변호사 필요 여부

**아니오 — 현재 시점 외부 변호사 즉시 감사 불필요.**

ADR-0013 Appendix A §조건 A (운영자 GTC 수동 열람에서 중간 강도 이상 조항 발견) 미충족.
ADR-0013 §B.7 조건 A/B/C/D 모두 미충족.
ADR-0004 §결정 3 기준(자체 legal 에이전트 우선, 외부는 베타 직전 €800 1회 + 수익 €5K/월
시점)에서 현재는 진행 가능 범위다.

§B.7 조건 C (어필리에이트 수수료 발생 = 상업 운영 신호)가 충족되는 시점, 즉 베타 진입 후
수익이 발생하는 시점에 CJEU Ryanair v PR Aviation (C-30/14) 리스크가 격상되므로, 그
시점에 €800 외부 감사 1회를 권고한다 (ADR-0013 Appendix A §조건 C 동일).

---

### 잔여 리스크 및 한계

1. **GTC 스코프 한계**: 검토한 두 PDF는 **가입자 서비스 약관**이다. 웹사이트 방문자에
   대한 별도 이용약관(Website Terms of Use)이 존재한다면 해당 문서가 직접 적용 약관이
   된다. Proximus/Telenet 웹사이트에서 방문자용 별도 이용약관 링크를 발견하지 못했으나
   (Appendix A WebFetch 시도 + Appendix B HTML 검토 기반), 별도 페이지가 사후 추가될
   가능성을 배제할 수 없다. robots.txt 월 1회 모니터링(B.5 공통 조건 4)에 TOS 변경
   모니터링을 병행 권장한다.

2. **언어 커버리지**: Proximus GTC는 영문판만 검토했다. FR/NL판에 추가 조항이 존재할
   가능성은 통신 약관 실무상 낮으나(다국어 판본은 동일 내용 번역이 일반적), 0%로
   단정할 수 없다. 베타 진입 전 €800 감사 시 FR/NL판 병행 검토 권장.

3. **Orange BE 미결**: Orange BE(PLAN 1.5.8) 소비자 TOS PDF 수동 열람은 이번 검토 범위 밖이다.
   Appendix B §B.9 조건 ("strictly personal use" 조항 소비자 TOS 미존재 확인)이
   여전히 충족되지 않았다. Orange BE 소비자 TOS PDF 수동 열람 = 1.5.8 진입의
   별도 선행조건으로 남는다.

4. **본 검토의 법적 지위**: 이 Amendment는 "1차 법무 검토 의견"이며 "법률 자문"이 아니다.
   변호사 검토를 대체하지 않는다.

---

**Appendix B Amendment 작성: legal 에이전트 (2026-05-28)**
**결론**: 1.5.6 (Proximus + Telenet) 코드 머지 게이트 **OPEN** (B.5 공통 조건 준수 전제).
**Orange BE (1.5.8)**: 소비자 TOS PDF 수동 열람 별도 선행조건 — 미완료.

---

## Amendment 3 (2026-05-28) — 접근법 재평가: 스텁 전제 붕괴 → 정정 + 페이지 단위 하이브리드 Cheerio 채택

### Status

**Accepted (architect, 2026-05-28)**. ADR status = **Accepted 유지** (옵션 C → 진입 기조
보존, Amendment 1 옵션 B 유사 진입 + 24h 게이트 + Amendment 2 GTC 보존). 본 Amendment는
**1.5.6 *진입 방법*의 정정**이지 분기 재격상(LOW/MEDIUM/HIGH)이 아니다. MEDIUM 2.75 분류
근거는 유효. 어필리에이트 피드(ADR-0014)는 트리거되지 않음 (Cheerio 가용 확인).

### Context — 무엇이 깨졌나

PLAN 1.5.6 본문 및 §평가 2(HTML 구조 안정성)는 "fetcher 파일의 `// 실 fetch 준비 코드`
주석 해제 + Cheerio 추가만으로 진입"을 전제했다. **메인 정찰(Claude, 2026-05-28)이 이
전제가 Telenet에서 깨졌다고 보고**:

1. 스텁 URL 2개 모두 stale (리다이렉트).
2. 사이트 = Adobe AEM + `wink` React 위젯, `/etc.clientlibs/` 1330건.
3. 메인 mobile 페이지 정적 HTML에 가격 class(price/prijs/tarief) 0건, JSON-LD = Organization만.
4. 가격 API 추정 `api.prd.telenet.be/{omapi,ocapi,searchapi}` = OAuth 게이트.
5. 결론: "정적 Cheerio 파싱으로 Telenet 가격 수집 불가".

### architect 정찰 검증 (WebFetch, 2026-05-28) — 전제 붕괴의 *원인 정정*

정찰 결론은 **부분적으로만 맞다**. 핵심 오류 = **잘못된 host/path 참조**:

- **Telenet mobile**: `www.telenet.be/.../mobiel.html` 은 **302 → `www2.telenet.be`** 로
  리다이렉트한다. 정찰은 `www`(또는 stale 경로)만 봤다. **`www2.telenet.be/residential/nl/producten/mobiel.html`
  (리다이렉트 종착지) 의 정적 HTML에는 가격이 *리터럴 텍스트*로 존재** — WebFetch 2026-05-28
  확인: Mobile Basic 15GB € 21/월, Mobile Unlimited € 41/월, combo promo € 56. 가격은
  JSON-LD/data-attr가 아닌 **HTML 본문 리터럴**, `wink` React 컨테이너 미검출.
  ⇒ **Telenet mobile = 정적 Cheerio 파싱 가능 (정찰 결론 반증)**.
- **Telenet internet**: `www2.../producten/internet.html` 의 정적 HTML에는 **기본 월정액
  가격이 없음** (Basic 200/Standard 500/Turbo 2.5Gbps plan명만, promo 단편만). ⇒
  **internet 페이지는 정찰 우려가 맞다 — 정적 파싱 불가/불충분**.
- **Proximus mobile**: `www.proximus.be/en/mobile-subscription` + `.../id_cr_msub_belfius/.../mobile-subscriptions.html`
  정적 HTML에 가격 리터럴 존재 — Mobile Essential €14.99→16.99, Easy €15.99→19.99,
  Smart €18.99→24.99, Maxi €21.99→29.99, Unlimited €34.99→49.99. React 위젯/clientlib
  미검출. ⇒ **Proximus mobile = 정적 Cheerio 파싱 가능**.
- **Telenet API**: `api.prd.telenet.be/omapi` = **HTTP 403** (인증 게이트 확인). 인증 우회
  시도 안 함. ⇒ 정찰의 "OAuth 게이트" 맞음. (a) 경로 = **거부 사유 확정**.

**정정 요약**: 정찰의 "JS 렌더링 = Cheerio 불가" 결론은 **host/path staleness가 원인**이었지
사이트의 근본적 JS-rendering 때문이 아니다. 단 **internet 페이지는 mobile과 다르게 가격이
정적 HTML에 없을 수 있다** — 즉 깨진 것은 "공급사 단위 전제"가 아니라 "*페이지 단위* 전제".

**미확인 (정직 명시)**:
- Proximus internet 페이지의 정적 가격 존재 여부 — 본 라운드 미확인 (URL 404 다수). 1.5.6
  진입 시 builder가 첫 fetch로 런타임 검증.
- mobile 가격이 *promo* 노출이고 standard 가격이 별도 클릭/오버레이로만 노출되는지 — WebFetch는
  렌더 후 일부 텍스트를 합칠 수 있어, builder가 *raw HTML(undici fetch)*로 셀렉터 매칭을
  반드시 재검증해야 함 (WebFetch ≠ raw fetch).
- Cloudflare/Akamai 봇 챌린지 첫 fetch 응답 — 여전히 미확인 (Amendment 1 §24h 게이트 유효).

### 4 경로 트레이드오프 (솔로/€300/Inngest free 30s·256MB/학습자)

| 경로 | 적합성 | 비용/리스크 | 판정 |
|---|---|---|---|
| **(a) 가격 API 리버스** (`api.prd.telenet.be`) | 403 OAuth 게이트. 인증 토큰 추출 = fragile + TOS 적합성 불명 + 인증 우회 윤리·법적 회색 | 높음 | **거부** — §대안 3 정신 + 우회 금지 |
| **(b) 헤드리스 Playwright** | Inngest free 30s step + 256MB cap 위협 (부팅 2-5s + 로드 2-10s + 150MB). ADR-0013 대안 3 "별도 ADR" 명시 | 높음 (학습자 디버깅 sink) | **거부 (현 단계)** — 정적 가용 페이지엔 과잉. internet 페이지가 끝내 정적 불가 시 재검토 |
| **(c) 수동 method='manual'** (ADR-0008 §T5 enum 존재) | 가장 단순·P3 정직·솔로 ~1h/월·ADR-0034 옵션 X 정직성과 정합 | 낮음 (시간 의존) | **부분 채택** — 정적 파싱 불가 페이지(예: Telenet internet)의 *폴백* |
| **(d) 어필리에이트 피드** Daisycon/Awin (TVA 발급됨 → 가입 자격 충족) | MONETIZATION §A #1(순위 무영향) 위협 = /data-sources 출처 노출 필수. advertiser 활성 미확인 | 중간 (윤리 가드레일 + 미확인) | **defer** — Cheerio 가용으로 1차 불필요. ADR-0014 미트리거 (예약 유지) |

### Decision — 페이지 단위 하이브리드 Cheerio (공급사 혼합 + 폴백)

ADR-0008 §T1/§T5 인터페이스는 fetcher별 `method` 혼합을 *이미 지원*. 채택:

1. **Telenet mobile + Proximus mobile = `method='scraping'` (Cheerio + undici)**. 정찰이
   주장한 "주석 해제만" 전제는 **무효** — **URL 정정 필수** (www2 host + 현행 경로 +
   plan명 정정: KING/KONG/Mobile Basic/Mobile Unlimited, Mobile Essential/Easy/Smart/Maxi/Unlimited).
   스텁의 prepared 코드 *경로는 보존하되 URL/셀렉터는 builder가 재작성*.
2. **internet 페이지 = 첫 fetch 런타임 검증 후 분기**: 정적 가격 매칭 성공 → `scraping`.
   실패(Telenet internet 현 관측) → **`method='manual'` 폴백** (ADR-0008 §T5 enum, 운영자
   ~1h/월 입력). confidence는 manual도 ADR-0008 §T3 휴리스틱 적용.
3. **24h 신선도 모니터링 게이트 = Amendment 1 그대로 유효** (Telenet 1개 먼저 → Proximus
   점진). 첫 fetch 응답 헤더(`Server`/`cf-ray`/`x-akamai-*`) + 챌린지 페이지 탐지.

### Consequences (정직 — CLAUDE.md §2)

- ✅ Telenet/Proximus **mobile = 실 데이터 가능** (정찰 비관 정정) → confidence 격상.
- ⚠️ **운영자가 "실 데이터" 택한 결정(ADR-0034)은 "Cheerio로 가능"이라는 전제 위에 있었고,
  그 전제는 *mobile에서만* 성립**. internet 페이지가 정적 불가면 *그 페이지는 manual*이
  되어 자동화 목표와 부분 배치 — 운영자 시간 의존 일부 잔존. **이 전제 부분 붕괴를 숨기지
  않는다**.
- ⚠️ "주석 해제 + Cheerio만" 1.5.6 본문 전제는 **거짓** — URL 전면 정정 + 셀렉터 신작 필요.
  builder 작업량이 본문 추정보다 큼.
- 🔁 ADR-0014(affiliate-feed-as-primary) **예약 유지 — 미트리거**. internet manual 폴백이
  장기 부담이 되거나 Cheerio 차단 시 ADR-0014 또는 Playwright 신규 ADR 재호출.
- 🔁 ADR-0008 §T1 attributes / §T4 union / §T5 method enum **변경 0** (혼합 이미 지원).

### 검증 방법

- builder 첫 fetch(undici raw HTML) 후 셀렉터 매칭 ≥ Telenet mobile 2 plan + Proximus
  mobile 5 plan → `method='scraping'`. internet 매칭 0 → `method='manual'` 폴백 등록.
- 24h 내 Sentry 차단(403/429/챌린지) 0건 → Amendment 3 정당화. 1건 → fetcher 비활성 +
  Amendment 4 (Playwright 또는 manual 전면 전환 재평가).
- harness:plan/data 정합 + confidence='low' 비율 < 20%.

### Amendment 3 — 구현 결과 (Proximus, 2026-05-29)

builder 첫 fetch(undici raw HTML) 검증 완료 — Amendment 3 §검증 방법 게이트 통과:

- **Proximus 스텁 URL 3개 모두 HTTP 404** → 현행 정정: mobile `www.proximus.be/en/mobile-subscription`,
  internet `www.proximus.be/en/internet` (둘 다 raw undici fetch 200, 챌린지 없음). architect가
  WebFetch로 본 URL과 일부 상이 → "WebFetch ≠ raw fetch" 경고가 정당했음을 재확인.
- **internet "미확인" 해소 = `scraping` (manual 폴백 *아님*)**: §Decision 2의 "정적 매칭 성공 →
  scraping" 분기 발화. Proximus internet 페이지 raw HTML에 4개 plan(Light/Go/Mega/Giga Fiber)
  월정액 + 표준가 + 다운/업로드 속도가 **정적 리터럴로 존재**. Telenet internet(정적 부재)과 달리
  Proximus internet은 정적 가능 → §Decision의 "*페이지 단위* 판단" 원칙이 공급사 간에도 갈림을 실증.
- **추출 = mobile 5 + internet 4 = 9 tariff**, 실 HTML 스냅샷 독립 검증 9/9 일치, **confidence='high'
  9/9 (low 0% < 20% §검증 방법 임계)**. 셀렉터: plan명 `span.rs-txt-s4`, 가격 `.rs-price-sm`/
  `.rs-price-promo` + 카드경계 `[class*="panel"]`, 표준 월정액 = mobile "€X as from the 7th month"
  / internet 패널 내 displayed보다 큰 €X.XX (€180·€240 "web discount"는 소수점 부재로 자동 제외).
- **ADR-0014 미트리거 유지** (Cheerio 가용). ADR-0008 §T1/§T4/§T5 변경 0.
- **24h 신선도 게이트(§Decision 3)는 머지 후 프로덕션 트랙**: Vercel/Inngest 프로덕션 IP 실 fetch +
  Sentry 차단 0건 확인이 잔존 게이트 — 로컬 게이트(typecheck/lint/test:run 679/harness)는 전부 통과.

### Amendment 3 작성: architect (2026-05-28) — WebFetch 검증 기반, 인증 우회 0

---

## Appendix C — Orange BE robots.txt + TOS 본문 검토 (legal 에이전트, 2026-06-04)

**검토 목적**: ADR-0034 D3 §legal 선행조건 + PLAN 1.5.8 선행조건 해소 (잔여 2개 공급사 중 1번).
Appendix B (2026-05-17) 에서 Orange BE 는 "조건부 진입 가능 🟡, 소비자 TOS PDF 수동 열람 필수"
판정을 받았다. 본 Appendix C 는 그 잔여 조건에 대한 추가 검토이다.

**검토일**: 2026-06-04 (UTC)

**실행 주체**: legal 에이전트 (1차 검토). 변호사 아님.

---

### C.1 robots.txt — 재확인

- source_url: `https://www.orange.be/robots.txt`
- fetched_at: 2026-06-04 (WebFetch 직접 확인)

Appendix B §B.3 (2026-05-17) 에서 기록한 Drupal 표준 robots.txt 와 동일 구조가 유지됨.
금번 fetch 결과:

```
User-agent: *
Allow: /core/*.css$
Allow: /core/*.js$
[CSS/JS/image Allow 패턴 — Drupal 표준]
Disallow: /core/
Disallow: /profiles/
Disallow: /admin/
Disallow: /comment/reply/
Disallow: /filter/tips
Disallow: /node/add/
Disallow: /search/
Disallow: /user/register/
Disallow: /user/password/
Disallow: /user/login/
Disallow: /user/logout/
[index.php 미러 경로]
Disallow: /*brand=
Disallow: /*category_product_type=
Disallow: /*connectivity=
Disallow: /*filter_color=
Disallow: /*filter_special_offer=
Disallow: /*memory=
Disallow: /*sp=
Disallow: /*internet=
Disallow: /*mobile=
Disallow: /*option=
Disallow: /*promocode=
Disallow: /*tp=
Disallow: /*filters
Disallow: /*topic
Disallow: /*m&tvm=
Disallow: /*option-
Disallow: /nl/opties-en-diensten/gsm-en-smartphone/online-instellen/*
Disallow: /fr/options-et-services/gsm-et-smartphone/configuration-en-ligne/*
```

- Crawl-delay: **없음**
- Sitemap: 명시 없음 (Drupal 표준 — Appendix B 동일)

**가격 페이지 경로 Disallow 분석**:

| 스크래핑 대상 경로 | robots.txt 규칙 충돌 여부 |
|---|---|
| `/fr/mobile/abonnements-gsm` (모바일 구독 — 정적 HTML 가격 확인됨, 2026-06-04) | **없음** |
| `/fr/produits-et-services/internet-chez-vous` (인터넷 — 정적 HTML 가격 확인됨) | **없음** |
| `/fr/produits-et-services/tv` (TV) | **없음** |
| 쿼리 파라미터 `?internet=`, `?mobile=` | **차단** — 경로 직접 fetch 방식 유지 필수 |

**C.1 결론**: Appendix B §B.3 결론 유지. 가격 경로 Disallow 없음. 쿼리 파라미터 방식만 차단.

---

### C.2 가격 페이지 공개 접근 정찰 — 2026-06-04

본 Appendix 검토 과정에서 실시한 WebFetch 직접 확인 결과 (fetched_at: 2026-06-04):

**모바일 (`/fr/mobile/abonnements-gsm` → 종착지 확인)**:
- 공개 접근: 로그인 없음. 정적 HTML에 가격 리터럴 존재.
- 확인된 플랜 및 가격:
  - Orange Mobile Small: €15/월
  - Orange Mobile Medium: €23/월 (프로모 €18, 6개월)
  - Orange Mobile Large: €29/월 (프로모 €20, 12개월)
  - Orange Mobile Unlimited: €40/월 (프로모 €31, 12개월)
  - Orange Mobile Child: €5/월
- **Cheerio 정적 파싱 가능성: 높음** (WebFetch 기준 — raw undici fetch builder 재검증 필수)

**인터넷 (`/fr/produits-et-services/internet-chez-vous`)**:
- 공개 접근: 로그인 없음. 정적 HTML에 가격 리터럴 존재.
- 확인된 플랜 및 가격:
  - Start Internet: €38/월 (프로모, 정규 €53/월)
  - Zen Internet: €47/월 (프로모, 정규 €62/월)
  - Giga Internet: €57/월 (프로모, 정규 €72/월)
- **Cheerio 정적 파싱 가능성: 높음** (동일 조건)

---

### C.3 TOS/GTC 본문 검토 — 웹사이트 방문자 대상 약관

#### C.3.1 약관 허브 페이지 (`/fr/conditions-generales`, fetched_at: 2026-06-04)

- 최종 URL: `https://www.orange.be/fr/conditions-generales`
- 구조: 소비자 대상 약관 허브. 모든 실제 약관은 PDF 링크로 제공됨.
- 허브 페이지 HTML 본문에서 자동 접근/스크래핑 명시 금지 조항: **없음**
- 확인된 PDF 카테고리:
  - General sales conditions / Subscription terms
  - Mobile plan terms (Small/Medium/Large/Unlimited/Child)
  - Internet & TV service terms
  - Fiber optic service conditions
  - Insurance terms
  - Privacy policy
- **HTML 텍스트 추출 가능 조항**: 없음 (모든 약관은 PDF 링크만 노출)

#### C.3.2 Privacy policy 페이지 (fetched_at: 2026-06-04)

- `/fr/politique-de-confidentialite` — HTTP 404 (URL 구조 변경 가능성)
- 웹사이트 방문자 대상 별도 이용약관(Website Terms of Use) 독립 페이지: 미발견.
- Orange BE 는 웹사이트 방문자 대상 이용약관을 GTC PDF 내부에 포함하는 구조로 추정.

#### C.3.3 Orange-business.com 그룹 TOS (Appendix B §B.3 기존 확인 내용 유지)

Appendix B (2026-05-17) 에서 확인한 orange-business.com 그룹 공통 법적정보 페이지의 조항:

- **지적재산권 조항**: "most of the information and data contained herein are protected by
  legal provisions relating to intellectual property rights" — 그룹 비즈니스 포털 기준.
- **무단 재현 금지**: "Any representation, reproduction, use, adaptation, or modification
  in whole or in part...is prohibited without...prior permission of Orange."
- **개인 사용 제한**: "The use of this site is reserved for the user's strictly personal use."

이 조항들은 `orange-business.com` (B2B 그룹 포털) 의 법적정보 페이지에서 확인됨.
`orange.be` (소비자 포털) 에 동일하게 적용되는지 여부는 여전히 PDF 수동 확인이 필요.

#### C.3.4 소비자 GTC PDF 상태

- Orange BE 소비자 약관 PDF 들은 WebFetch FlateDecode 압축으로 텍스트 추출 불가 (Appendix B 동일).
- **운영자 pdftotext 수동 열람**: 본 Appendix C 작성 시점 미완료.
  → Appendix B Amendment (2026-05-28) 에서 Proximus/Telenet 은 pdftotext 로 완료했음.
  → Orange BE 소비자 GTC PDF 는 동일 방법으로 운영자가 별도 완료 필요 (Pieter 트랙).

---

### C.4 핵심 미결 리스크 — "strictly personal use" 조항

Appendix B §B.6 및 §B.7 에서 이미 식별된 핵심 미결 리스크:

- **그룹 TOS 확인**: orange-business.com 에서 "strictly personal use" 조항 존재 확인.
- **소비자 TOS 미확인**: orange.be 소비자 약관 PDF 에 동일 조항 존재 여부 미확인.
- **CJEU Ryanair v PR Aviation (C-30/14, 2015) 리스크**: 만약 소비자 TOS 에 "utilisation
  strictement personnelle" 또는 동등 조항이 존재하고, 그것이 상업적 비교 사이트의 자동화
  가격 수집을 명시 금지하는 맥락에서 사용된다면, 계약적 제한 근거가 될 수 있음.
- **현재 강도 판정**: 미확인 (소비자 PDF 미열람). Appendix B §B.7 "조건 B" 트리거 잠재.

**중요 관찰 (2026-06-04)**: 소비자 약관 허브 (`/fr/conditions-generales`) HTML 페이지 자체에는
자동 접근 금지 조항이 없으며, 방문자 이용약관 독립 페이지도 미발견. 이는 Orange BE 가 웹사이트
방문자 이용 제한을 소비자 GTC PDF 내에 포함하거나 아예 별도 명시하지 않는 구조일 가능성을 시사.

---

### C.5 법적 리스크 프레임워크 — 3층 분석 업데이트

| 분석 층 | Appendix B 판정 | 본 Appendix C 업데이트 |
|---|---|---|
| EU DB Directive 96/9/EC | 낮음 — 1일 1회 가격 추출, "substantial part" 기준 미달 가능성 | 유지 — 변경 없음 |
| CJEU Ryanair v PR Aviation | 중간 — "strictly personal use" 그룹 TOS 확인, 소비자 TOS 미확인 | 유지 — 소비자 GTC PDF 미열람으로 미확인 상태 지속 |
| CDE Art. VI.99 (BE 불공정경쟁) | TOS 명시 금지 미확인, 리스크 낮음 | 유지 |

---

### C.6 최종 판정

**판정: 🟡 조건부 (Appendix B §B.3 + §B.9 판정 유지)**

- robots.txt: 가격 페이지 경로 차단 없음. **PASS** (B.5 공통 조건 준수 전제)
- TOS HTML: 자동 접근 명시 금지 조항 없음 (허브 페이지 기준). 단 소비자 GTC PDF 미열람.
- 가격 페이지: 공개 접근 가능, 정적 HTML 가격 존재 (WebFetch 확인). Cheerio 파싱 가능성 높음.
- 소비자 GTC PDF "strictly personal use" 조항 여부: **미확인 (핵심 잔여 리스크)**.

**코드 진입 차단 여부**: 차단 아님. 단 GTC PDF 수동 열람이 완료되지 않은 상태이므로 **조건부**.

**차단 조건 (이 중 하나 충족 시 코드 머지 금지)**:
1. 운영자 pdftotext 수동 열람에서 Orange BE 소비자 GTC에 "utilisation strictement personnelle"
   또는 동등 수준의 자동화 접근 금지 조항이 **중간 강도 이상**으로 발견될 경우
2. 발견된 조항이 비교 사이트 상업적 사용에 명시 적용 가능한 경우 → legal 에이전트 즉시 재호출
3. ADR-0034 §회귀 #5 (cease & desist)

---

### C.7 Pieter 트랙 (병행 필수, ~30분)

**Orange BE 소비자 GTC PDF 수동 열람**:

1. `https://www.orange.be/fr/conditions-generales` 접속 → "Conditions générales de vente"
   또는 "Conditions générales – Abonnements" PDF 클릭 → 브라우저로 다운로드
2. 로컬 `pdftotext` 변환 (Appendix B Amendment 2026-05-28 동일 방법)
3. Ctrl+F 검색 키워드 (우선 순위 순):
   - 프랑스어: "utilisation strictement personnelle", "automatisé", "robot", "scraping",
     "extraction automatique", "utilisation commerciale", "usage personnel"
   - 네덜란드어: "strikt persoonlijk gebruik", "geautomatiseerde", "robot", "automatisch"
   - 영어 (혹시 EN 버전 있다면): "strictly personal use", "automated", "robot", "scraping"
4. 발견 시: 조항 번호 + 원문 전달 → legal 에이전트 재호출 (Appendix C Amendment 추가)
5. 미발견 시: Appendix C Amendment에 "GTC 수동 열람 완료, 자동 접근 명시 금지 없음" 기록
   → 1.5.8 코드 머지 게이트 OPEN

**본 Appendix C PASS (robots.txt + TOS HTML) + Pieter 트랙 GTC PDF 수동 열람 미발견
= 1.5.8 코드 진입 허용.**

---

**Appendix C 작성: legal 에이전트 (2026-06-04)**

---

## Appendix D — Voo robots.txt + TOS + 점유율 검토 (legal 에이전트, 2026-06-04)

**검토 목적**: ADR-0034 D3 §legal 선행조건 + PLAN 1.5.9 선행조건 해소 (잔여 2개 공급사 중 2번).
Appendix B (2026-05-17) §B.4 에서 Voo 는 "조건부 진입 가능 🟡, GTC 수동 열람 선택적" 판정을
받았다. 본 Appendix D 는 시장 상황 변화(Voo→Orange 합병) 반영 + PLAN 1.5.9 "점유율 미검증"
해소를 위한 추가 검토이다.

**검토일**: 2026-06-04 (UTC)

**실행 주체**: legal 에이전트 (1차 검토). 변호사 아님.

---

### D.1 시장 상황 변화 — Voo-Orange 합병 (중요)

**WebSearch 확인 (2026-06-04)**:

Voo S.A. 는 Orange Belgium 에 흡수 합병되었다. 주요 사실:

| 항목 | 내용 | 출처 |
|---|---|---|
| 합병 완료 | 2025년 10월 1일, Orange Belgium + VOO 단일 법인 | ITdaily.com |
| 지분 구조 | Orange Belgium 이 Voo 지분 75%-1주 취득, 기업가치 €1.8B | Orange Newsroom |
| 법인 소멸 | Voo S.A. 법인 소멸. 고정망 자산·고객·영업·부채 → Orange 이전 | telecoms.com |
| 브랜드 | Orange 가 Voo 브랜드명 2024년에 은퇴 발표. 일부 제품 라벨로는 잔존 | 복수 출처 |
| 웹사이트 | `voo.be` 도메인은 2026-06-04 현재 여전히 운영 중 (direct WebFetch 확인) | 본 검토 |

**Slim 1.5.9 fetcher 설계 영향**:
- Voo 가 Orange 브랜드로 통합됨에 따라 `voo.be` 의 가격 구조가 `orange.be` 와 점진 동기화될
  가능성이 높음. fetcher 타겟이 `voo.be` 에서 `orange.be` (Voo 고객 전용 페이지 또는 통합
  페이지) 로 이동해야 할 수 있음. 이는 **법적 검토 범위 밖의 아키텍처 결정** — architect
  재호출 권고 사항으로 기록한다 (§D.7 참조).

---

### D.2 점유율 검토 — PLAN 1.5.9 "점유율 미검증" 해소

**WebSearch 결과 (2026-06-04, source: Mordor Intelligence + WebSearch aggregation)**:

Orange Belgium + Voo 합병 후 벨기에 통신 시장 구조:

| 사업자 | 매출 점유율 (Q1 2025 기준) | 고정 브로드밴드 | 비고 |
|---|---|---|---|
| Proximus | ~43% | ~45% | 1위 |
| Telenet (Liberty Global) | ~32% | - | 2위 |
| Orange Belgium (+ Voo 통합) | ~22.5% | - | 3위 (Voo 포함) |

- source: Mordor Intelligence Belgium Telecom MNO Market report (WebSearch 2026-06-04 aggregation)
- fetched_at: 2026-06-04

**Voo 독립 점유율 (합병 전)**:
- Voo 는 주로 왈로니아(Wallonia) + 브뤼셀 지역 케이블 고정망 사업자.
- 합병 전 독립 기준 시장점유율 별도 1차 출처(BIPT 공식 분기 보고서) 를 WebSearch + WebFetch 로
  수집하지 못했음. BIPT Statistics 페이지 (`bipt.be/operators/telecommunications/statistics`)
  는 링크 확인됐으나 분기별 세부 CSV/수치는 유료/로그인 접근으로 추정.
- **대안 추정**: Orange + Voo 합산 ~22.5% 에서 Proximus(43%) + Telenet(32%) 제외 시 잔여가
  Orange+Voo 합산임. Voo 고정망 단독은 약 10-15% 추정 (왈로니아 권역 집중 특성).

**PLAN 1.5.9 "점유율 미검증" 상태 해소 여부**:
- BIPT 공식 1차 출처 분기 수치 확보: **미달** (공개 무료 데이터 미발견).
- Mordor Intelligence 집계 기준 Orange+Voo 합산 ~22.5% (Q1 2025): **확보**.
- Voo 단독 구분 수치: **미확보** (합병으로 별도 보고 종료).
- 판정: **부분 해소** — 합산 수치는 확보, Voo 독립 수치는 합병으로 소멸. ADR-0009 가
  Proximus+Telenet ≥75% 가정 위에 있으므로, Orange+Voo 합산 ~22.5% 는 그 가정을 간접 지지함.

---

### D.3 robots.txt — 재확인

- source_url: `https://www.voo.be/robots.txt`
- fetched_at: 2026-06-04 (WebFetch 직접 확인)
- 전문:

```
User-agent: *

Sitemap: https://www.voo.be/sitemap.xml
```

- Crawl-delay: **없음**
- Disallow: **단 하나도 없음** (4개 provider 중 가장 관대 — Appendix B §B.4 동일)
- 변경사항: **없음** (Appendix B 2026-05-17 버전과 동일)

**D.3 결론**: Appendix B §B.4 결론 유지. 어떤 경로도 Disallow 없음.

---

### D.4 가격 페이지 공개 접근 정찰 — 2026-06-04

WebFetch 직접 정찰 결과 (fetched_at: 2026-06-04):

| URL 시도 | 결과 |
|---|---|
| `voo.be/fr/internet` | 200 OK. 가격 없음 — "Nos prix à partir du 1 Janvier 2026" 링크(PDF). 정적 HTML 가격 부재 확인. |
| `voo.be/fr/gsm` | HTTP 404 |
| `voo.be/fr/tarifs` | HTTP 404 → `voo.be/fr` (홈) 로 리다이렉트 |
| `voo.be/fr/nos-offres` | HTTP 404 |
| `voo.be/fr/nos-offres-internet` | HTTP 404 |
| `voo.be/fr/internet-television-telephonie/` | HTTP 404 |
| `voo.be/fr/decouvrir/internet` | HTTP 404 |
| `voo.be/fr/` (홈) | 200 OK. 가격 없음. "Nos prix à partir du 1 Janvier 2026" 링크 (PDF) |

**핵심 관찰**: `voo.be/fr/internet` 에서 인터넷 플랜 설명은 있으나 **가격이 PDF로만 제공됨**
("Nos prix à partir du 1 Janvier 2026 [PDF 링크]"). 모바일 가격 페이지 URL 도 발견 불가.

이는 **기술 리스크** (Cheerio 정적 파싱 불가 가능성) 이지 법적 리스크가 아니다. 단 fetcher
구현 시 PDF 파싱 또는 대안 경로가 필요할 수 있음 → architect 에 인계 필요 (§D.7).

---

### D.5 TOS/GTC 본문 검토 — 재확인

#### D.5.1 Conditions générales (`/fr/conditions-generales`, fetched_at: 2026-06-04)

Appendix B §B.4 (2026-05-17) 에서 이미 텍스트 추출 완료한 결과 재확인:

- 자동 접근/스크래핑 명시 금지: **없음** (키워드 검색 완료)
- 확인된 조항 상세:

  **Art. 7.1 (가격 공개 조항)**: "Details of its current pricing...can be found [here]"
  — 공개 가격 정보이며 추출 금지 조항 없음. (source: `voo.be/fr/conditions-generales`,
  fetched_at: 2026-05-17 + 2026-06-04 재확인)

  **Art. 16.1 (지적재산권)**: 방송 프로그램 콘텐츠 보호 조항. 요금제 가격 데이터에 직접
  적용 불가.

  **Art. 17.2 (사용 제한)**: "서비스 및 콘텐츠는 배타적으로 사적·개인적 사용 목적" —
  Voo 인터넷 서비스 *가입자*의 서비스 사용 정책. 웹사이트 방문자의 데이터 수집에 적용
  되는 조항이 아님.

  **인터넷 서비스 사용 조항**: "les offres de service internet illimité de VOO sont
  conditionnées à un usage privé et personnel du Client" — 마찬가지로 Voo 인터넷 서비스
  *가입자*의 인터넷 사용 정책. 웹사이트 방문자 스크래핑 스코프 다름.

#### D.5.2 Privacy Policy (`/fr/vie-privee`, fetched_at: 2026-06-04)

- 자동 접근/스크래핑 조항: 없음.
- 저작권: "Copyright © 2025 VOO. Tous droits réservés." — 일반 저작권 표시만.

#### D.5.3 법적 고지 (`/fr/mentions-legales`)

- HTTP 404. 별도 법적 고지 페이지 없음 (Appendix B §B.4 동일).

**D.5 결론**: Appendix B §B.4 "자동 수집 명시 금지 없음, 가장 낮은 리스크" 판정 **유지**.

---

### D.6 최종 판정

**판정: 🟢 PASS (법적 조건부 해소)**

- robots.txt: Disallow 전무. **PASS**
- TOS: 자동 접근 명시 금지 없음 (HTML 텍스트 추출 완료). **PASS**
- GTC PDF 수동 열람: Appendix B §B.4 에서 "선택적 (우선순위 최하위)" 판정. TOS HTML
  이미 텍스트 추출 완료 — 추가 수동 열람 없이도 판정 가능.
- 합병 영향: Voo 브랜드는 잔존하나 `voo.be` 가격 체계가 Orange 와 통합 진행 중일 수 있음.
  이는 법적 리스크가 아닌 **아키텍처 리스크** — 별도 인계.

**외부 변호사 즉시 감사 필요 여부**: **아니오**.
- ADR-0013 §B.7 조건 A/B/C/D 미충족.
- ADR-0004 §결정 3 기준에서 현재 진행 가능.

**1.5.9 코드 진입 허용 여부**: B.5 공통 조건 준수 전제로 **허용**.
단 §D.7 아키텍처 리스크 (가격 페이지 HTML 부재 + Orange 통합 진행) 를 architect 가
먼저 평가한 후 fetcher URL 확정 권고.

---

### D.7 architect 인계 사항 (법적 범위 밖 — 아키텍처 리스크)

1. **Voo 가격 페이지 HTML 부재**: `voo.be/fr/internet` 에서 가격이 PDF로만 제공됨 (정적
   HTML 파싱 불가). Cheerio fetcher 구현 전 architect 가 실 URL 정찰 + raw undici fetch
   검증 필요. PDF 파싱 또는 `method='manual'` 폴백 여부 결정 필요.

2. **Orange-Voo 통합 진행 리스크**: Voo 브랜드가 Orange 로 통합되면 `voo.be` URL 구조가
   변경되거나 `orange.be` 로 리다이렉트될 수 있음. 1.5.9 fetcher 타겟 URL 안정성이
   Proximus/Telenet 대비 낮을 수 있음 — fetcher 셀렉터 깨짐 위험 ↑.

3. **fetcher 대안 경로**: `voo.be` 가격 페이지가 완전 불가 시 Orange BE fetcher (1.5.8)
   확장으로 Voo 고객 대상 Orange BE 요금제를 함께 커버하는 방안 검토 가능.

---

### D.8 Pieter 트랙

**Voo GTC PDF 수동 열람**: Appendix B §B.8 에서 "낮은 우선순위 — TOS HTML 이미 검토됨"
으로 판정. 본 Appendix D 검토에서도 TOS HTML 재확인 완료 → GTC PDF 추가 수동 열람은
**선택적** (필수 아님).

단 Orange-Voo 통합으로 인해 향후 Voo TOS 가 Orange 약관으로 대체될 가능성이 있음.
TOS URL 변경 시 legal 에이전트 재호출 권고.

**Pieter 트랙 (선택적, ~15분)**:
- `voo.be/fr/conditions-generales` 의 PDF 버전이 별도 존재한다면 다운로드 + pdftotext 확인.
- 검색 키워드: "automatisé", "robot", "extraction", "scraping", "usage personnel exclusif"
- 미발견 시: 별도 기록 불필요 (HTML 검토로 충분).

**본 Appendix D PASS (robots.txt 전면 허용 + TOS 자동 수집 금지 없음) = 1.5.9 코드
진입 허용. 단 architect 가격 페이지 URL 정찰 + 아키텍처 결정 선행 권고 (§D.7).**

---

**Appendix D 작성: legal 에이전트 (2026-06-04)**

---

## Appendix B Amendment (2026-06-05) — 운영자 GTC 수동 열람 완료 (Orange BE)

**실행 주체**: legal 에이전트 (1차 검토). 변호사 아님.

**검토 대상**: Orange BE 3종 소비자 GTC PDF (Proximus/Telenet Amendment = 2026-05-28 완료,
Orange BE = 본 Amendment 대상).

**기존 Appendix B + Appendix C 본문**: 변경 없음. 본 Amendment는 Appendix C §C.7 Pieter 트랙
실행 결과를 append한다.

---

### 검토 방식

Appendix B Amendment (2026-05-28, Proximus/Telenet) 와 동일한 pdftotext 트랙 적용.
운영자가 브라우저로 Orange BE 소비자 GTC PDF 3종을 직접 다운로드한 후 로컬 `pdftotext`
(poppler) 로 텍스트 추출. 본 Amendment 작성자가 `Read` 도구로 추출 텍스트를 직접 확인하여
키워드 검색 결과를 대조했다. 이하 조항 분류 및 판정은 **원문 직접 확인 기반**이다.

검토 파일 3종:

| 파일 | 원본 PDF | 발행 | 분량 |
|---|---|---|---|
| `C:\Users\kimwo\gtc-review\orange-be-postpaid.txt` | GC_2307006_postpaid_FR_20241015.pdf | Orange Belgium s.a. BE0456.810.810, 10/2024 | 794줄 |
| `C:\Users\kimwo\gtc-review\orange-be-sales.txt` | gc_2001001_sales_fr.pdf (Annexe 4) | Orange Belgium s.a., 03/2020 | 128줄 |
| `C:\Users\kimwo\gtc-review\orange-be-fiber.txt` | GC_2307006_Fiber_update_FR_20241022.pdf | Orange Belgium s.a., 09/2023 | 711줄 |

4번째 PDF (Love bundle — Conditions internet et TV 번들)는 Imperva WAF 403 차단으로 운영자가
다운로드 불가 상태. 단 Appendix B §B.3 에서 기록된 Orange BE robots.txt 의 `Disallow: /*internet=`
/ `Disallow: /*mobile=` 쿼리 파라미터 패턴이 Love bundle configurer URL을 robots 수준에서 이미
차단한다. 또한 PLAN 1.5.8 fetcher 범위는 mobile + internet_fixed 단품으로 정의되어 있어 Love
bundle 페이지는 fetcher 스코프 밖 — **Love PDF WAF 차단은 본 Amendment 판정에 영향 없음**.

---

### 키워드 검색 결과 표

B.8 체크리스트 키워드를 3종 PDF 전문에서 검색한 결과:

자동 접근/스크래핑을 **직접 금지**하는 조항: **0건** (3종 합산).

| 파일 | 매칭 문구 | 원문 위치 | 실제 스코프 | 판정 |
|---|---|---|---|---|
| postpaid L473-474 | "Les cartes SIM seront destinées à un usage purement personnel" | §5.1 Usage normal | SIM 카드 개인 사용 목적 — 재판매/rerouting 금지. 웹사이트 접근 스코프 밖 | false positive |
| postpaid L476-478 | "interdit...commercialiser le Service Orange" | §5.1 Usage normal | Orange 서비스(통신 서비스) 재판매 금지 — 웹사이트 가격 데이터 수집과 무관 | 스코프 밖 |
| postpaid L524 | "utiliser les services de transmission de données à des fins personnelles et normales" | §5.3.3 Utilisation des services de transmission de données 항목 4 | 데이터 전송 **서비스**(통신 회선) 개인적·정상 사용 요건 — 가입자 AUP. 웹사이트 방문자 스크래핑 스코프 밖 | 스코프 밖 |
| postpaid L562-577 | §5.5 Logiciels Orange — 소프트웨어/문서 IP 복사·디컴파일 금지 | §5.5.2~5.5.3 | Orange가 가입자에게 제공하는 **앱/모뎀 펌웨어** IP 조항 — 웹사이트 가격 데이터와 무관 | 스코프 밖 |
| postpaid L303/356 | "processus automatisé de la base de référence centrale" | §4.3.6/§4.4.4 번호 이식 절차 | 번호이식 인프라의 자동화 DB 처리 — false positive (사업자 간 인프라 조항) | false positive |
| fiber L237 | "n'effectuer aucun démontage, aucune décompilation...de l'Equipement d'Orange" | §7.1.2 Utilisation | 모뎀·디코더 **하드웨어** 개조·디컴파일 금지 — 웹사이트 스크래핑 무관 | 스코프 밖 |
| fiber L295-300 | "usage normal des Services...exclusivement pour son usage privé et familial...ne pas commercialiser ou transférer les Services" | §9 Obligations et responsabilité du Client | Orange 인터넷·TV **서비스** 가입자 사용 제한 — 웹사이트 방문자의 가격 데이터 수집 스코프 밖 | 스코프 밖 |
| fiber L309 | "droits d'utilisation des Services d'Orange sont personnels et incessibles" | §9 Obligations | 서비스 사용권 양도불가 조항 — 가입자 서비스 계약 조항 | 스코프 밖 |
| fiber L639-645 | "Il est impossible de copier des enregistrements" | §1.2 Enregistrement (Services TV) | TV 녹화 복사 금지 (DRM) — 웹사이트 가격 데이터와 무관 | 스코프 밖 |
| fiber L676-682 | §3 Droit de propriété intellectuelle — "utilisation familiale et privée" + DRM 우회 금지 | §3 Droit de propriété intellectuelle | TV 콘텐츠(디코더 내 방송) DRM 조항 — 가격 페이지 스크래핑 무관 | 스코프 밖 |
| fiber L686 | "ne peut entreprendre aucune action visant à manipuler, esquiver ou entraver les règles de sécurité et d'utilisation établies par Orange" | §3 동일 | TV DRM 시스템 보안 우회 금지 — 웹사이트 접근 스코프 밖 | 스코프 밖 |
| sales (전체) | — | 전문 128줄 | 물품 판매 조건 (배송/결제/반품) 전용. 자동 접근/스크래핑 조항 0건 | 해당 없음 |

핵심 부재 키워드 확인:

- `scraping`, `robot`, `crawler`, `spider`, `extraction automatique`, `agrégateur`, `comparateur`:
  3종 PDF 합산 **0건**.
- `utilisation strictement personnelle` / `strictly personal use` (Appendix C §C.4 핵심 우려
  키워드): **0건**. 검색된 "personnel" 매칭은 전부 (a) 개인정보("données à caractère
  personnel"), (b) 서비스/SIM/장비 사용 제한(계약자 본인용), (c) 직원("personnel d'Orange")
  3개 유형 중 하나이며 공개 가격 페이지 스크래핑 스코프 밖이다.
- "automatisé" / "automatique": 번호이식 인프라 DB 처리(false positive) + 계약 자동갱신(false
  positive) 2건만. 웹사이트 자동 접근 금지 맥락 **0건**.

---

### 조항 강도 판정 — ADR-0013 §B.7 프레임워크 적용

#### Appendix C §C.4 핵심 미결 리스크 해소

Appendix C (2026-06-04) 가 식별한 핵심 미결 리스크: orange-business.com 그룹 TOS의 "strictly
personal use" 조항이 orange.be 소비자 GTC 에도 동일하게 존재하는지 여부.

본 Amendment 3종 PDF 직접 확인 결과:

- **"utilisation strictement personnelle"** / **"strictly personal use"** / **"strikt persoonlijk
  gebruik"**: 3종 PDF 전문 합산 **0건** — 소비자 GTC에 해당 문구 또는 동등 조항이 존재하지
  않음을 원문 직접 확인으로 검증.
- orange-business.com 그룹 TOS의 "strictly personal use" 조항은 B2B 그룹 포털 특유의 조항으로,
  orange.be 소비자 GTC 에 이식되지 않았음이 확인된다.

Appendix C §C.4 우려 사항: **해소됨**.

#### Orange BE 매칭 조항 강도 분류

검색된 모든 매칭 항목은 Proximus/Telenet Amendment (2026-05-28) 에서 확립된 분류 기준과
동일 패턴을 따른다:

1. **가입자 서비스 약관 스코프**: 모든 "personnel" + 서비스 사용 제한 조항은 Orange Belgium
   서비스 **가입자**("Client")를 적용 당사자로 한다. Slim은 Orange 서비스 가입자가 아니라
   공개 웹사이트 방문자이므로, CJEU Ryanair v PR Aviation (C-30/14) 관점에서 이 GTC가
   Slim의 스크래핑 행위에 계약적으로 구속력을 갖는 법적 근거가 없다.

2. **IP/DRM 조항 스코프**: §5.5 Logiciels Orange(앱·펌웨어 IP) + Fiber §3(TV 콘텐츠 DRM)
   모두 소프트웨어 또는 방송 콘텐츠에 적용되는 IP 조항이며, 공개 가격 페이지의 가격 데이터에
   직접 적용되지 않는다.

3. **하드웨어 조항 스코프**: Fiber §7.1.2(모뎀 개조 금지)는 Orange가 임대 제공하는 물리
   장비에 관한 조항이다.

**Orange BE 강도 판정: 약함 (WEAK)** — 자동 접근/스크래핑 직접 금지 0건. 존재하는 조항은
전부 (a) 가입자 서비스 AUP, (b) 소프트웨어/방송 IP, (c) 하드웨어 사용 제한 중 하나로,
공개 가격 페이지 스크래핑 스코프 밖이다. §B.9 차단 조건 "중간 강도 이상" **미충족**.

이는 Proximus(WEAK, 2026-05-28) + Telenet(WEAK, 2026-05-28)과 동일 패턴이다.

---

### §B.9 차단 조건 가부 판정

**Orange BE 차단 조건 충족 여부**: **미충족**.

- "utilisation strictement personnelle" 조항 소비자 GTC 존재: **확인되지 않음** (3종 PDF 전문
  직접 확인). Appendix C §C.4 핵심 우려 해소.
- "중간 강도 이상 자동접근 금지 조항 발견": **해당 조항 없음**. 차단 조건 미충족.

**결론: 1.5.8 코드 머지 게이트 — OPEN**.

Orange BE GTC 수동 열람 완료 결과, §B.9 차단 조건(중간 강도 이상 자동접근 금지 조항 발견)을
충족하는 조항이 발견되지 않았다. B.5 공통 조건(일 1회 이하 fetch, 정직한 User-Agent,
요금제 경로 직접 fetch, 쿼리 파라미터 방식 사용 금지, robots.txt 모니터링, /legal/affiliate-disclosure
출처 표기, 차단 발생 시 즉시 비활성)을 준수하는 것을 전제로 1.5.8 fetcher 코드 머지를
차단하지 않는다.

---

### §B.9 표 갱신 — Orange BE 판정 업데이트

기존 §B.9 표 (2026-05-17):

| PLAN 항목 | 대상 Provider | 판정 | 조건 |
|---|---|---|---|
| **1.5.8** | Orange BE | 🟡 조건부 진입 가능 | B.5 공통 조건 + 운영자 Orange BE 소비자 TOS PDF 수동 열람 필수 선행 + "strictly personal use" 조항 소비자 TOS 미존재 확인 |

본 Amendment 갱신 후:

| PLAN 항목 | 대상 Provider | 판정 | 조건 |
|---|---|---|---|
| **1.5.8** | Orange BE | 🟢 **PASS (선행조건 해소, 2026-06-05)** | B.5 공통 조건 준수 전제. GTC 수동 열람 완료 — "utilisation strictement personnelle" 및 자동접근 직접 금지 조항 0건 확인. Proximus/Telenet과 동일 패턴(WEAK). Love bundle PDF WAF 차단은 fetcher 스코프(단품) 외로 판정에 영향 없음. |

---

### 외부 변호사 필요 여부

**아니오 — 현재 시점 외부 변호사 즉시 감사 불필요.**

ADR-0013 Appendix A §조건 A (운영자 GTC 수동 열람에서 중간 강도 이상 조항 발견) 미충족.
ADR-0013 §B.7 조건 A/B/C/D 모두 미충족.
ADR-0004 §결정 3 기준에서 현재 진행 가능.

§B.7 조건 C (어필리에이트 수수료 발생 = 상업 운영 신호) 충족 시점, 즉 베타 진입 후 수익이
발생하는 시점에 CJEU Ryanair v PR Aviation (C-30/14) 리스크가 격상되므로, 그 시점에 €800
외부 감사 1회를 권고한다 (ADR-0013 Appendix A §조건 C, Appendix B Amendment 2026-05-28 동일).

---

### 잔여 리스크 및 한계

1. **Love bundle PDF 미열람**: Love bundle (Conditions internet et TV 번들) PDF는 Imperva WAF
   403 차단으로 운영자가 다운로드 불가. 단 PLAN 1.5.8 fetcher 범위가 mobile + internet_fixed
   단품으로 정의되어 있고, robots.txt가 해당 URL 패턴을 Disallow하므로 fetcher가 Love bundle
   페이지를 접근하지 않는 구조. 향후 1.5.8 fetcher가 bundle 페이지를 포함하는 방향으로 범위
   확장 시 별도 legal 검토 트리거 필요.

2. **GTC 스코프 한계**: 검토한 3종 PDF는 **가입자 서비스 약관**이다. 웹사이트 방문자 대상 별도
   이용약관(Website Terms of Use)이 추후 신설될 경우 해당 문서가 직접 적용 약관이 된다.
   robots.txt 월 1회 모니터링(B.5 공통 조건 4)에 TOS 변경 모니터링 병행 권장.

3. **본 검토의 법적 지위**: 이 Amendment는 "1차 법무 검토 의견"이며 "법률 자문"이 아니다.
   변호사 검토를 대체하지 않는다.

---

**Appendix B Amendment 작성: legal 에이전트 (2026-06-05)**
**결론**: 1.5.8 (Orange BE fetcher) 코드 머지 게이트 **OPEN** (B.5 공통 조건 준수 전제).
**직접 금지 0건, false positive만 매칭 — Proximus/Telenet과 동일 패턴.**

---

## Appendix B Amendment (2026-08-19) — Orange Love 번들 GTC 확보 + 4.26.a 번들 라운드 legal 게이트

**실행 주체**: Pieter (1차 기계 스캔). 변호사 아님. **법률 자문 아님.**

**트리거**: [ADR-0053](0053-telecom-provider-ecosystem-expansion.md) §D5 — 번들 fetcher 라운드(PLAN 4.26.a) 착수 전 공급사별 GTC/robots 검토 선행 조건.

---

### B.10.1 왜 새 Amendment 가 필요했나 — 2026-06-05 가 남긴 공백

Appendix B Amendment (2026-06-05) 는 Orange BE 3종(postpaid / sales / fiber)을 검토하고 **4번째 문서를 명시적으로 제외**했다:

> 4번째 PDF (Love bundle — Conditions internet et TV 번들)는 Imperva WAF 403 차단으로 운영자가 다운로드 불가 상태. (…) PLAN 1.5.8 fetcher 범위는 mobile + internet_fixed **단품**으로 정의되어 있어 Love bundle 페이지는 fetcher 스코프 밖 — **Love PDF WAF 차단은 본 Amendment 판정에 영향 없음**.

그 면제 논리는 **fetcher 스코프가 단품이라는 전제**에 걸려 있었다. ADR-0053 §D6 이 Q3 = "번들 먼저" 를 잠그면서 **번들이 스코프 안으로 들어왔고**, 따라서 그 전제가 소멸했다. Love GTC 는 이제 직접 적용 문서다.

### B.10.2 두 가지 기술 장벽이 해소됐다

| 장벽 | 2026-06-05 상태 | 2026-08-19 실측 |
|---|---|---|
| Love PDF 접근 | Imperva WAF **403 차단** | **200 OK** — 경로가 `orange.be/sites/b2c/files/2024-10/` 로 확인됨. 브라우저 UA, 정상 `%PDF-` 매직, 593,680 bytes |
| PDF 텍스트 추출 | WebFetch FlateDecode 실패 → **운영자 브라우저 다운로드 필수** | 로컬 `pdftotext` (poppler, `/mingw64/bin/pdftotext` v4.00) **가용 확인** |

두 번째가 특히 중요하다 — B.8 체크리스트가 "운영자 수동 열람" 을 전제한 이유는 텍스트 추출 실패였고, 그 제약이 사라졌다. **본 Amendment 는 운영자 개입 0 으로 수행됐다.**

### B.10.3 검토 파일

| 파일 | 원본 PDF | 발행 | 분량 |
|---|---|---|---|
| `C:\Users\kimwo\gtc-review\orange-be-love-fr.txt` | `GC_2309010 Love_FR_202410.pdf` | Orange Belgium, 10/2024 | 927줄 (UTF-8) |

문서 제목 확인: *"Conditions générales — Services internet, TV et téléphonie fixe d'Orange"* — Love 번들(인터넷·TV·유선전화) 직접 적용 약관이 맞다.

NL 대응본 존재 확인: `GC_2309010 Love_NL_202410.pdf` (동일 디렉토리). 본 검토는 FR 판 기준 — 2026-06-05 검토가 FR 판 기준이었던 것과 정합.

### B.10.4 B.8 키워드 검색 결과 — 직접 금지 **0건**

| 키워드 | 매칭 |
|---|---|
| `scraping` / `robot` / `extraction` / `aspiration` | **0** |
| `strictement personnel` / `usage commercial` / `utilisation commerciale` / `revente` | **0** |
| `automatis` | 1 (false positive) |
| `systématique` | 1 (false positive) |

매칭 2건 원문:

| 위치 | 원문 | 실제 스코프 | 판정 |
|---|---|---|---|
| L88 | *"Les notions suivantes apparaissent dans les présentes Conditions Générales et ont **systématiquement** la signification donnée ci-dessous"* | 정의 조항 상용구 | false positive |
| L824 | *"…en raison de l'échange obligatoire de données via le processus **automatisé** de la [base de référence centrale]"* | 번호이식(portabilité) 인프라의 사업자 간 자동 DB 처리 | false positive |

**2026-06-05 postpaid 검토의 L303/356 매칭과 동일 패턴이다** (번호이식 인프라 조항). 웹사이트 공개 가격 페이지 수집과 무관.

### B.10.5 robots.txt 재확인 (2026-08-15/19 실측)

- Proximus / Telenet: 번들 경로 `Disallow` **없음**.
- Orange: `Disallow` 2건 존재하나 전부 `support/assistance-technique` **도움말 경로** — 상품 페이지 무관.
- 2026-06-05 이 지적한 `Disallow: /*internet=` / `Disallow: /*mobile=` **쿼리 파라미터 패턴**은 Love **configurer** URL 을 차단한다. 4.26.a 정찰 대상인 `orange.be/fr/produits-et-services/internet-tv-mobile` 은 **쿼리 파라미터가 없어 해당 패턴에 매칭되지 않는다**.
  > **B.10.5 잠금 조건**: 번들 fetcher 는 **쿼리 파라미터가 붙은 configurer URL 을 요청하지 않는다.** 정적 상품 목록 페이지만 대상으로 한다. 이 조건을 깨면 robots 위반이 된다.

### B.10.6 판정

**4.26.a 번들 fetcher 라운드 legal 게이트 = 조건부 OPEN.**

| 공급사 | 번들 적용 약관 | 검토 | 판정 |
|---|---|---|---|
| Proximus | 소비자 일반 GTC (2025-01판) | 2026-05-28 | 직접 금지 0건 (WEAK) |
| Telenet | Algemene voorwaarden (2025-03판) | 2026-05-28 | 직접 금지 0건 (WEAK) |
| Orange | **Love 번들 GTC** (10/2024) | **2026-08-19 (본 Amendment)** | **직접 금지 0건 (WEAK)** |

조건 = B.5 공통 조건 준수 + **B.10.5 configurer URL 미요청**.

### B.10.7 잔여 / 한계 (정직 표기)

1. **Proximus Special T&C 4종 미검토** — Proximus 는 *일반 GTC + 서비스별 Special T&C* 구조다. `Special-Terms-and-Conditions---Internet---EN` / `---TV---EN` / `---Fixed-telephony---EN` / `---Mobile-phone---EN` 은 검토하지 않았다. 웹사이트 이용·자동수집 조항은 통상 일반 GTC 에 위치하므로 리스크는 낮다고 **추정**하나 **확인하지 않았다**. 번들 fetcher 가 실제 가격 수집을 시작한 뒤 조기 확인 권장.
2. **Telenet 번들 전용 약관 부재 확인** — 약관 페이지 PDF 3건(Play Sports / DAZN / kabelbrochure) 중 번들 GTC 없음. 일반 Algemene voorwaarden 가 적용된다고 판단.
3. **본 검토는 기계 키워드 스캔 + 매칭 원문 확인**이다. 조항 전문(全文) 법적 독해가 아니다. Amendment 3/4 선례대로 **1차 법무 검토 의견**이며 변호사 검토를 대체하지 않는다.
4. Orange Love **NL 판 미검토** (FR 판만). 2026-06-05 선례와 동일한 범위.

---

**Appendix B Amendment 작성: Pieter (2026-08-19) — 운영자 개입 0 (WAF 해제 + 로컬 pdftotext 가용)**
**결론**: PLAN 4.26.a 번들 fetcher 라운드 legal 게이트 **조건부 OPEN** (B.5 + B.10.5 준수 전제).
**Orange Love 직접 금지 0건 — Proximus/Telenet 및 Orange 3종과 동일 패턴.**


---

## Amendment 4 (2026-07-13, Draft) — Orange BE mobile 페이지 재정찰: JS-rendered 전제 붕괴 → 정적 파싱 가능 확인 + fetcher 스코프 확장

### Status

> ## ❌ **Rejected (2026-08-16, 운영자 — raw fetch 재검증으로 전제 반증)**
>
> 본 Amendment 의 핵심 주장("JS-rendered 전제 붕괴 → 정적 파싱 가능")은 **재현되지 않았다.**
> 근거 정찰이 **WebFetch** 로 수행됐고, WebFetch 는 JS 실행 후 결과를 반환한다 —
> 본 ADR **Amendment 3 이 명시적으로 경고한 "WebFetch ≠ raw fetch"** 함정에
> 그대로 빠진 사례다. 상세는 아래 §Amendment 4 재검증 (2026-08-16) 참조.
>
> **1.5.8 (2026-06-05) 의 원 판정 — "Orange BE mobile = JS 렌더링, fetcher 미커버" — 이 유효하다.**
> PLAN 4.24 는 본 Rejected 에 따라 **취소**됐다.

~~**Draft (architect, 2026-07-13)**. ADR status = Accepted 유지 (Amendment 3 §Decision "*페이지 단위* 판단" 원칙 재적용). 본 Amendment는 **Orange BE mobile 페이지의 스코프 재분류**이지 분기 재격상(LOW/MEDIUM/HIGH)이 아니다. MEDIUM 2.75 분류 근거는 유효. Amendment 3 §Decision 2 ("정적 매칭 성공 → scraping" 분기)의 재발화 사례.~~

~~**Accepted 격상 조건**: 운영자 승인 + builder 라운드 착수 트리거.~~ — 격상되지 않았다.

본문은 **반증 이력 보존 가치**로 남긴다 (ADR-0047 §D3 "옵션 비교 이력 보존" 동형).

### Context — Amendment 3 전제의 재검증

**PLAN 1.5.8 완료 시점 (2026-06-05)** `src/fetchers/orange-be.ts` 헤더 잠금:

> Mobile 페이지 (`/fr/mobile/abonnements-gsm`):
> `<obe-dps-price>` 웹 컴포넌트 (JS 런타임 렌더링)로 가격 표시.
> 정적 HTML 에는 `discount-text=" "` placeholder 만 존재 — 표시 가격 부재.
> ADR-0013 Amendment 3 의 "internet 매칭 0 → manual 폴백" 패턴 역방향 사례 —
> Orange BE 는 mobile 이 JS 렌더링. 본 fetcher 는 mobile 미커버 (정직 표기)

즉 Amendment 3 §Decision 2 페이지 단위 분기 (정적 매칭 성공 → scraping / 실패 → manual 폴백) 에서 Orange BE mobile 은 "정적 매칭 실패" 판정을 받았고, ADR-0034 D4 페이즈 5 후속 라운드로 미룸.

**2026-07-13 재정찰** (Pieter, WebFetch `https://www.orange.be/fr/mobile/abonnements-gsm`): **Orange BE mobile 페이지가 정적 HTML 로 개편되었음이 관측됨**. 4 tier 파싱 성공:

| Tier | Data | Speed | Std price | Promo | Promo mo |
|---|---|---|---|---|---|
| Small | 12 GB | 5G 400 Mbps | €15/mo | — (no promo) | — |
| Medium | 70 GB | 5G 1 Gbps | €23/mo | €18/mo | 6 |
| Large | 140 GB | 5G 1 Gbps | €29/mo | €20/mo | 12 |
| Unlimited | unlimited | 5G 1 Gbps | €40/mo | €31/mo | 12 |

**전제 붕괴**: Amendment 3 §미확인 (2026-05-28) 목록 4번째 항목 — "WebFetch ≠ raw fetch" 경고 재확인 필요. 본 Amendment 4 는 WebFetch 만 관측 — builder 첫 fetch(undici raw HTML) 로 정찰 재검증이 필수 게이트.

### architect 정찰 검증 (WebFetch, 2026-07-13) — 페이지 단위 원칙 재적용

Amendment 3 §Decision 2 "정적 매칭 성공 → scraping" 분기의 **재발화**:

- **Orange BE mobile (재관측)**: 4 tier 가격이 정적 HTML 리터럴에 존재 (WebFetch 확인). `<obe-dps-price>` 웹 컴포넌트가 정적 텍스트로 fall-back 렌더링을 노출하거나, Orange BE 가 SEO 목적으로 SSR 을 강화한 것으로 추정. **DOM 구조 (셀렉터 후보)**: 미확인 (WebFetch 는 렌더 후 텍스트 반환) → **builder 첫 fetch (undici raw HTML) 로 셀렉터 잠금 필수**.
- **Orange BE internet (기존)**: `.obe-pricebox` × 3 = 정적 파싱 확정 (1.5.8 프로덕션 실증). 변경 0.
- **voo.be**: 2025-10-01 합병 후 여전히 정적 가격 부재 상태 (ADR-0034 Amendment 1 §Decision #1) — 본 Amendment 4 스코프 밖.

**미확인 (정직 명시)**:
- Mobile 페이지 raw HTML (undici fetch) 의 실제 셀렉터 이름 — WebFetch 는 렌더 후 텍스트만 노출, class/데이터 속성 불명 → **builder 첫 fetch 로 셀렉터 후보 3종 (`.obe-pricebox` 재사용 여부 / 신규 컨테이너 클래스 / 4 tier 카드 wrapper) 잠금**.
- 표시 가격이 promo 인지 std 인지 구분 방식 — Amendment 3 §Decision 3 원칙 (`<del>` 정가 + `.obe-price-amount` 표시 가격 = 프로모) 를 mobile 에도 재사용 가능한지 실 HTML 로 검증.
- Cloudflare/Imperva 챌린지 첫 fetch 응답 — mobile 페이지 URL 은 internet 페이지와 다른 CDN 정책 가능성. Amendment 3 §Decision 3 24h 신선도 게이트 재적용.

### Decision — Orange BE fetcher mobile 스코프 확장

Amendment 3 §Decision "페이지 단위 하이브리드 Cheerio" 원칙 재적용. 채택:

**D1. Fetcher 구조 — 기존 `orange-be.ts` 확장 (신설 X)**

- 기존 `orange-be.ts` 에 `parseMobilePlans($, ...)` 함수 병렬 추가. `parseInternetPlans` 와 동일 패턴.
- `fetch()` 함수 = `fetchPage(INTERNET_SOURCE_URL)` + `fetchPage(MOBILE_SOURCE_URL)` 두 번 (page-unit fetch). Amendment 3 §B.5 공통 조건 "일 1회 이하 fetch" 정합 (같은 provider = 같은 cron trigger = 1회/일, 2 페이지 fetch 는 페이지 단위지 provider 단위 아님).
- 두 페이지 중 하나 실패 시 부분 성공 반환 (기존 internet-only 폴백 경로 = 100% 실패 시 ok:false 유지, 부분 성공 = ok:true + data 감소).
- Metadata 갱신: `categories: ['internet_fixed']` → `['internet_fixed', 'mobile']`. `FETCHER_VERSION` = `'orange-be@2026-07-13'` 격상.
- **거부한 대안** (별도 `orange-be-mobile.ts` 신설): 같은 provider = 같은 provider_slug (`orange-be`) → registry 중복 + `admin-metrics.buildMethodCaseExpression` (providerSlug × category 매핑) 자연 처리 재사용 상실. Proximus fetcher 도 mobile + internet 을 한 파일로 처리 (동형 패턴). 파일 크기는 200 LOC 정도 증가 예상 — 관리 가능.

**D2. Zod schema — `mobileAttributesSchema` 재사용 (신설 X)**

- `src/types/tariff-attributes.ts` `mobileAttributesSchema` 이미 존재 (data_gb / voice_minutes / sms / eu_roaming_included / throttle_after_gb_speed_kbps).
- Orange BE mobile 4 tier 는 이 스키마에 자연 매핑:
  - Small: `data_gb: 12`, `voice_minutes: 'unlimited'` (추정 — builder 첫 fetch 실 HTML 확인 필수), `sms: 'unlimited'`, `eu_roaming_included: true`
  - Medium/Large: `data_gb: 70/140`, 동일
  - Unlimited: `data_gb: 'unlimited'`, 동일
- 신규 스키마 0. ADR-0005 §T1 변경 0.

**D3. Legal 게이트 — 재검토 불필요 (Appendix B Amendment 2026-06-05 재사용)**

- Orange BE 소비자 GTC 3종 PDF (postpaid / sales / fiber) 는 Appendix B Amendment (2026-06-05) 에서 "직접 금지 0건, WEAK" 판정 완료. postpaid PDF §5.1 (SIM 카드 개인 사용 목적) 는 서비스 가입자 스코프 조항으로 공개 mobile 가격 페이지 스크래핑에 적용 안 됨 (Appendix B Amendment 2026-06-05 표 postpaid L473-474 판정).
- **mobile 페이지 URL 자체가 robots.txt Disallow 대상인지 재확인 필수** (builder DoD): Appendix C §C.1 (2026-06-04) 기록 = `Disallow: /*mobile=` 는 쿼리 파라미터 패턴. `/fr/mobile/abonnements-gsm` 경로는 쿼리 없음 → 미차단 예상. 그러나 robots.txt 는 시점 가변 → builder 첫 fetch 전 재확인.
- 결론: **legal 재호출 트리거 없음** (B.9 표 1.5.8 판정 🟢 PASS 재사용).

**D4. Prod 배포 게이트 — Amendment 3 §Decision 3 + 1.5.8 프로덕션 트랙 재적용**

- 로컬 게이트: typecheck 0 / lint 0 / test:run 0 실패 / harness:plan/data 정합.
- 프로덕션 게이트 (머지 후):
  - Vercel/Inngest 프로덕션 IP 실 fetch 성공 (메모리 `project_fetcher_prod_ip` 정합 — 로컬 fetch 성공 ≠ 프로덕션 성공, Imperva/Cloudflare 데이터센터 IP 차단 가능).
  - 실 Neon DB `tariff_snapshot` Orange BE mobile 4 tier 누적 확인.
  - 24h 신선도 모니터링 (admin 헬스).
  - `confidence='low'` < 20% (§검증 방법 §Amendment 3).
  - Sentry 차단(403/429/챌린지) 0건 → Amendment 4 정당화. 1건 → mobile 파트만 자동 비활성 + Amendment 5 트리거.

### Consequences (정직 — CLAUDE.md §2)

- ✅ Orange BE mobile 4 tier 실 데이터 커버 → confidence 격상 가능. `/data-sources` mobile 커버리지 표기 정직성 회복 (Orange BE mobile "후속 라운드" → "실 데이터"). 시장 대표성 향상 (Orange BE mobile 잔여 gap 해소).
- ⚠️ **Amendment 3 (2026-05-28) 시점 관측이 6주 만에 뒤집힘 = 통신사 페이지 마크업의 *시점 가변성*을 실증**. Orange BE 가 SEO 또는 UI 리팩토링으로 SSR 을 강화한 것으로 추정 (정확한 원인은 미확인). 이는 페이지 단위 스크래핑의 근본적 fragile 성질을 재확인 — Amendment 3 §B.5 공통 조건 "셀렉터 재검증 트리거" 정합.
- ⚠️ Fetcher 파일 크기 증가 (~200 LOC 추정). 관리 가능하나 향후 provider 페이지 수 ≥ 3 이면 파일 분할 재검토 (별도 refactor ADR 트리거).
- ⚠️ 2 페이지 fetch × 1일 = fetch 횟수 2배 (Amendment 3 §B.5 "일 1회 이하 fetch" 는 provider 단위 정합, 페이지 단위 아님). Orange BE 부담 증가 미미 (일 2 request), 그러나 정직 명시.
- 🔁 mobile 페이지가 재차 JS-rendered 로 회귀할 가능성 상존 → Amendment 3 §B.5 셀렉터 재검증 트리거 자동 발화 (rawPayload.warnings 에 "obe-pricebox not found" 또는 mobile plan-name span not found 검출 시 자동 비활성 + Sentry).
- 🔁 ADR-0014 (affiliate-feed-as-primary) **미트리거 유지** (Cheerio 가용 재확인).

### 검증 방법

**게이트 A — builder 첫 fetch 정찰** (구현 착수 전):
- undici raw HTML fetch `https://www.orange.be/fr/mobile/abonnements-gsm` — WebFetch 결과와 raw HTML 이 일치하는지 셀렉터 관측 검증 (Amendment 3 "WebFetch ≠ raw fetch" 경고 정합).
- 셀렉터 후보 3종 (`.obe-pricebox` 재사용 / 신규 클래스 / 4 tier 카드 wrapper) 확정.
- 챌린지 페이지 미검출 확인.
- 4 tier 각각 std price + promo price + data_gb + speed 추출 성공.

**게이트 B — 로컬 게이트**:
- typecheck 0 / lint 0 / test:run 0 실패 (신규 unit 8~10 + integration 3~4 케이스).
- harness:plan/data 정합.
- `confidence='low'` 로컬 케이스 비율 < 20%.

**게이트 C — 머지 후 24h 프로덕션 신선도 게이트** (1.5.8 트랙 재사용):
- Vercel/Inngest 프로덕션 IP 실 fetch 성공 확인 (Inngest 대시보드 로그).
- 실 Neon DB `tariff_snapshot` Orange BE mobile 4 tier 누적.
- 24h 내 Sentry 차단 0건.
- admin 헬스 mobile 카테고리 활성 tariff 비율 회복 확인.

24h 후 통과 시 본 Amendment 4 → Accepted 격상. 미통과 시 mobile 스코프 자동 비활성 + Amendment 5 트리거 (원인 진단 + 다음 라운드 결정).

### 영향

**PLAN.md 갱신**:
- **§4.24 신설** (본 Amendment 4 트리거) — 상세 명세는 PLAN 4.24 참조.
- 1.5.8 본문 변경 0 (역사적 기록 보존 — 2026-06-05 시점 mobile 미커버 판정은 그 시점에 정확).

**다른 ADR과의 관계**:
- ADR-0008 §T1/§T4/§T5 변경 0 (mobile 카테고리 매핑 자동 재사용).
- ADR-0005 §T6 변경 0 (mobile 카테고리 enum 이미 존재).
- ADR-0034 D4 (4→3 fetcher, Voo 흡수) 변경 0 (본 Amendment 는 fetcher 개수 변경 X, 스코프 확장만).
- Amendment 3 (2026-05-28) 페이지 단위 원칙 **재적용 사례**로 append.

**Fetcher 헤더 정직성 갱신**:
- `src/fetchers/orange-be.ts` 헤더 docblock 에서 mobile 페이지 = JS-rendered 판정 문구 **삭제 금지** (역사 기록 보존, 헌법 P3 정합).
- 대신 헤더 하단에 "2026-07-13 재정찰: mobile 정적 파싱 가능 확인 → Amendment 4 스코프 확장" 1줄 append. Amendment 3 문구는 (a) 역사 기록 (b) 셀렉터 fragile 실증으로 보존.

### 사이즈 추정

**1-2일** — 근거:
- Day 1 (~6h): builder 첫 fetch 정찰 (게이트 A, 30분) + `parseMobilePlans` 신설 (~150 LOC, 2h — `parseInternetPlans` 패턴 재사용) + `fetch()` 함수 병렬 fetch 확장 (~50 LOC, 1h) + Metadata categories 갱신 + version 격상 (~10 LOC, 15분) + unit 테스트 8~10 케이스 (~200 LOC, 2h — 기존 `orange-be.test.ts` fixture 패턴 재사용) + integration 3~4 케이스 (~100 LOC, 1h).
- Day 2 (~4h): 로컬 게이트 통과 (게이트 B, 30분) + PR 생성 (`gh pr create`, 15분) + 운영자 머지 (별 트랙) + 프로덕션 IP 실 fetch 확인 (Inngest 대시보드, 15분) + 24h 신선도 관찰 (게이트 C, 백그라운드) + Amendment 4 → Accepted 격상 + provider seed 재확인 (`scripts/seed-providers.ts` orange-be 이미 존재, 신규 seed 불필요 — 메모리 `project_provider_seed_required` 정합).

1.5.8 P1 (2026-06-05) 실적 = ~2일 (정찰 + 구현 + 프로덕션 게이트) → 본 Amendment 4 는 같은 fetcher 확장이므로 학습 곡선 절감 + robots/legal 재검토 0 → **1-2일 상한 확정**.

### 잃는 것 / 부채

- Mobile 페이지 셀렉터 재검증 트리거 (`rawPayload.warnings` "mobile pricebox not found") 가 새 자동 비활성 경로 추가 → Sentry 알림 볼륨 증가 가능 (2 페이지 monitoring). 관리 가능.
- Fetcher 파일 크기 증가 (관리 가능, refactor 트리거 없음).
- 2026-05-28 → 2026-07-13 (6주) 사이 Orange BE 마크업 변경의 **원인은 미확인** — SEO 강화 추정만. 이후 회귀 가능성 상존, 재검증 트리거로 완화.

**Amendment 4 작성: architect (2026-07-13) — WebFetch 재정찰 기반, builder 첫 fetch raw HTML 재검증 게이트 A 필수**

---

## Amendment 4 재검증 (2026-08-16) — ❌ 게이트 A 불통과 → Amendment 4 Rejected

Amendment 4 는 스스로 **"builder 첫 fetch raw HTML 재검증 게이트 A 필수"** 를 조건으로 걸었다.
PLAN 4.24 착수 직전 그 게이트를 실행했고, **전제가 반증됐다.** 절차는 설계대로 작동했다 —
Amendment 가 자기 게이트를 통과하지 못한 것이다.

### 방법

프로덕션 fetcher 와 **동일한 UA** 로 raw fetch (WebFetch 아님):

```
UA: Slim/1.0 (+https://slim.lu; price comparison; contact kim.wonmin91@gmail.com)
대상: /fr/mobile/abonnements-gsm  (200, 251KB)
      /nl/mobiel/gsm-abonnementen (200, 245KB)
```

### 관측 1 — `<obe-dps-price>` 웹 컴포넌트가 **그대로 있다**

1.5.8 (2026-06-05) 이 Orange BE mobile 을 미커버로 판정한 그 마커다. 사라진 적이 없다.
raw HTML 에 5개 인스턴스 존재:

```html
<obe-dps-price product-slug="mob-s"  show-suffix="true" ...>
<obe-dps-price product-slug="mob-m"  ... discount-text="23 €/maand na 12 maanden">
<obe-dps-price product-slug="mob-l"  ... discount-text="29€/maand na 12 maanden">
<obe-dps-price product-slug="mob-xl" ... discount-text="40 €/maand na 12 maanden">
<obe-dps-price-legals>
```

본 Amendment §Context 가 인용한 1.5.8 헤더 문구 — *"정적 HTML 에는 `discount-text` placeholder 만
존재 — 표시 가격 부재"* — 가 **현재도 정확히 성립**한다. 달라진 것은 `discount-text` 가 빈 값에서
**프로모 종료 후 가격**으로 채워졌다는 점뿐이다.

### 관측 2 — Amendment 4 가 기록한 프로모 가격 4개가 raw HTML 에 없다

| 티어 | Amendment 4 기록 (WebFetch) | raw HTML 존재 |
|---|---|---|
| Small 12GB | €15 (no promo) | ❌ |
| Medium 70GB | €18 promo → €23 | ❌ (€23 만 `discount-text` 로 존재) |
| Large 140GB | €20 promo → €29 | ❌ (€29 만) |
| Unlimited | €31 promo → €40 | ❌ (€40 만) |

`<script>` 블록 15개(총 57KB) 전수 검색: `mob-s`/`mob-m`/`mob-l`/`mob-xl` 슬러그별 가격
페이로드 **0건**, 가격 API 엔드포인트 흔적 **0건**. 프로모 가격은 런타임에 컴포넌트가 가져온다.

### 정적으로 얻을 수 있는 것 / 없는 것

| 얻을 수 있음 | 얻을 수 없음 |
|---|---|
| 티어명 (Orange Mobile Small/Medium/Large/XL) | **프로모(헤드라인) 월정액 4개 전부** |
| `product-slug` (`mob-s`/`m`/`l`/`xl`) | |
| 데이터 GB (12 / 70 / 140) · 5G 속도 · 통화/SMS 조건 | |
| **프로모 종료 후 가격** (`discount-text`) | |

### 왜 "부분 편입"을 채택하지 않았는가

post-promo 가격만 싣는 선택지가 있었으나 **거부**한다. `ComparisonTable` 의 주 비교 숫자는
월정액이고 Proximus·Telenet 은 **프로모 가격**을 싣는다. Orange 만 프로모 종료 후 가격이
들어가면 비교 기준이 어긋나 **Orange 가 부당하게 비싸 보인다** — 헌법 §3 P1(공급사 가격 가공
금지) + P3 정합 위반. 정렬·절약액 계산도 왜곡된다.

### 결정

1. **Amendment 4 → Rejected.** 1.5.8 원 판정("Orange BE mobile = JS 렌더링, 미커버") 유효.
2. **PLAN 4.24 취소** (107 → 106). 1.5.9 Voo fetcher 취소 (ADR-0034 Amd 1) 와 동형 처리.
3. **Playwright 도입은 본 라운드에서 채택하지 않는다.** 본 ADR §1498 이 이미 Amendment 4 를
   "Playwright 또는 manual 전면 전환 재평가" 트리거로 지정했으나, 3사 중 1개 카테고리를 위한
   새 의존성 + CI 시간 + 운영자 €300/월 cap 영향이 비대칭이다. 재평가는 **커버리지 압력이
   더 커진 시점**([ADR-0053](0053-telecom-provider-ecosystem-expansion.md) §D7 공급사 확장 트랙)으로 이연.
4. **사용자 표면 정정**: `/guides/proximus-vs-telenet-vs-orange-be` 커버리지 표가
   *"Coming next round — static HTML re-confirmed 2026-07"* 로 표기 중이었다. 본 재검증으로
   **거짓이 된 문구**이므로 3 locale 동시 정정 (P1).

### 방법론 교훈 (Amendment 3 경고의 2차 실증)

Amendment 3 은 *"architect 가 WebFetch 로 본 URL 과 일부 상이 → WebFetch ≠ raw fetch 경고가
정당했음을 재확인"* 이라 적었다. Amendment 4 는 **같은 함정에 다시 빠졌다.**

> **규칙 (재확인)**: fetcher 편입 판정의 「어떻게」 축은 **프로덕션과 동일한 UA 의 raw fetch**
> 로만 확정한다. WebFetch / 브라우저 기반 관측은 **판정 근거로 쓰지 않는다** — 정찰 착수
> 단서로만 쓴다. [ADR-0053](0053-telecom-provider-ecosystem-expansion.md) §D6 "부정 판정 시 2개 표기 패턴 재확인" 규칙과 짝을 이룬다.
