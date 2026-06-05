# ADR-0034: 전략 전면 피벗 — 완성 우선 + organic SEO 런치 (베타 게이트 제거 / 다국어 동시 / 실 데이터 / 4 공급사)

## Status

**Accepted (2026-05-17 — 운영자(Kim Wonmin) 직접 결정 / architect 적용)**.
운영자가 D1~D5 + 잔여 결정을 *전부 명시 잠금*했다. 본 ADR 은 **운영자 의식적
결정의 형식 기록 + 블래스트 반경 명시** 다. 본 ADR 은 ADR-0003 이 *막으려고
설계된 바로 그 scope 리스크* 를 운영자가 의식적으로 수용하는 결정이다. 그
사실을 숨기지 않는다 (Pieter 는 사용자에게 거짓말하지 않는다 — CLAUDE.md §8).

**격상 이력:**
- Proposed (2026-05-17) — 정찰. D1~D5 + 마케팅 피벗 + 블래스트 반경 (전임
  architect).
- **Accepted (2026-05-17)** — 운영자 D1~D5 + 잔여 결정 명시 잠금. 본문에
  잠금값 확정 반영. 영향받는 ADR 의 amend(6)/deprecate(2) + 카피 4파일
  DEPRECATED + INDEX.md 행 갱신 + PLAN.md 전면 재구조화 일괄 적용 (architect,
  본 턴). typecheck/lint/test/harness:plan = verifier 후속 검증.
- **Amendment 1 (2026-06-04)** — **D4 정정: 4 → 3 fetcher (Voo 흡수)**.
  legal 에이전트 6/4 보고 + WebSearch 10개 출처 (ITdaily, Marketscreener,
  Brusselstimes 등) 교차 검증 = **Voo-Orange Belgium 합병이 2025-10-01 완료**
  (VOO S.A. 법인 소멸, Orange Belgium 흡수). D4 결정 시점(2026-05-17) WebSearch
  부재로 누락된 외부 사실. 새 잠금: **Proximus/Telenet/Orange BE 3 fetcher**
  (Orange BE fetcher 가 합병 후 Voo 잔존 가격 페이지까지 자연 흡수). 1.5.9
  Voo fetcher 항목 **취소** (PLAN 합계 93→92). 상세 = 본문 §Amendment 1
  (D4 정정) 절. architect 본 턴 적용. 운영자 reject 시 본 Amendment amend 가능.

> 잠금 단 한 건의 미결: **KO 의 운명** (런칭/개발 완료 후 KO 삭제 vs hidden
> 유지) — 운영자가 *그때 결정* 으로 명시 보류. 본 ADR 은 이것만 미결로 남기고
> D1~D5 의 그 외 모든 항목은 확정.

---

## Context

### 무엇이 우리를 이 결정 앞에 세웠는가

운영자가 2026-05-17 프로젝트 전략을 **전면 피벗**하기로 결정했다. 운영자 원문
(뉘앙스 보존):

> "그거 지워 완성하고 마케팅은 내가 알아서 할거야 구글 seo serch consol 해서
> 사람 모을거야 계획 전면 수정해. 사이트 완성 할거고 완성 되면 사람 모을거야.
> 영어 네덜란드어 프랑스어로 만들면서 검증하면 하나하나 내가 완성 할거야."

KO hiding 사유 (운영자 원문):

> "결국 내가 개발을 하려면 한국어가 필요해 검증하는 과정을 거쳐야 하니까
> 편집자 모드처럼 한국어를 하이딩 하고 나만 접근할 수 있게 만들어 놓고 개발이
> 완료되면 그때 지우던 하이딩 하던 하자"

### 정직한 맥락 — ADR-0003 의 솔로 현실 전제가 왜 무효화되는가

ADR-0003 (PLAN 리얼리즘 패스, Accepted 2026-05-09) 은 운영자 현실(솔로 사이드,
주 8~20시간, 개발 3개월, 월 €300 ALL-IN)에 맞춰 PLAN 을 *의도적으로 좁혔다*:

- **§결정 1** — 통신 BE 우선 (에너지 후순위)
- **§결정 2** — 페이즈 5 진입은 **M16 4-신호 게이트** (매출 ≥ €1,000/월 +
  CVR ≥ 3% + fetcher 안정성 ≥ 95% + 운영자 시간 ≥ 주 10h) 통과 시에만
- **§결정 4** — 원 페이즈 4(전환) + 페이즈 7(런치) → 새 페이즈 4 통합 (베타)
- **§대안 B** — "5개 카테고리 동시 시작" 을 **명시적으로 거부** ("솔로에서
  fetcher 12개를 동시에 만드는 것은 불가능. 검증 안 된 카테고리에 시간 매몰 =
  회복 불가")

본 ADR 의 D1~D4 는 **ADR-0003 §결정 2·§대안 B 가 막으려던 정확히 그 방향**
(검증 게이트 없는 멀티 채널 동시 빌드)을 운영자가 *의식적으로 수용*하는
것이다. ADR-0003 의 거부 사유는 *기술적으로 여전히 유효*하다 — 운영자가
"리스크를 알고 선택" 하는 것이지, 리스크가 사라진 것이 아니다. 본 ADR
§Consequences §"잃는 것" 에 이 재현되는 리스크를 *숨기지 않고* 명시한다.

### 무엇이 ADR-0003 당시와 *달라졌는가* (피벗을 합리화하는 사실)

운영자 결정을 정직하게 맥락화하기 위해, ADR-0003 (2026-05-09) 이후 진행된
사실:

- 페이즈 1~3 + 1.5/3.5 + 4.1~4.5 **이미 완료** (작업 추적 메타: 86 항목 중
  58 완료, 2026-05-16). 즉 "사이트 완성" 의 코어(데이터 레이어 + 입력 +
  결과 + 어트리뷰션 + 후속 메일)가 *기능적으로 존재*.
- ADR-0033 (2026-05-16) 이 next-intl 인프라를 *이미 배선* (4.5.j 완료 —
  `app/[locale]/` 라우팅 + middleware + `messages/ko.json`). 즉 다국어
  **라우팅 골격은 이미 깔려 있고**, 본 피벗은 그 위에 nl/fr/en 콘텐츠를
  *베타 전에* 채우는 것 (ADR-0033 은 4.9 런치 게이트로 미뤘던 것).
- 베타 모집(ADR-0029)은 한국인 시드 ≤50명 3채널로 *이미 축소된 상태* —
  운영자가 그 좁은 모집조차 직접 운영하기보다 "사이트 완성 후 organic SEO"
  를 택함.

이 사실들이 ADR-0003 §대안 B 의 거부 사유("12 fetcher 동시")를 *완화하지는
않는다* — D3+D4 는 4 fetcher × 실 스크래핑 × 4 locale 동시이므로 부담은
여전히 크다. 단 "검증 안 된 카테고리에 시간 매몰" 리스크는 *통신 단일
카테고리 깊이 유지* 시 부분 완화된다 (§D 잔여 결정에서 카테고리 범위
운영자 확정 필요).

### 본 ADR 이 직접 받는 의존성

- **CLAUDE.md §3 P1** (정보 우선 — 출처) — D3 실 스크래핑은 P1 강화 (스텁
  "추정값" → 실 데이터). 단 §8 #2 (가격 가공 0) 준수.
- **CLAUDE.md §3 P3** (투명성은 운영자의 짐) — D5 SEO 피벗은 추적 0 정신
  보존 확인 필요 (§D5 §정합 확인).
- **CLAUDE.md §8 #1** (사용자 데이터 외부 전송 0) — Google Search Console
  정합성 §D5 에서 명시 확인.
- **ADR-0003 §결정 2·§대안 B** — 본 ADR D2 가 정면으로 무효화 (운영자 결정).
- **ADR-0033** — i18n 라우팅 골격 (본 피벗이 그 위에 콘텐츠 backfill 당김).
- **ADR-0013 §평가 6 옵션 X / Amendment 1** — 스텁 "추정값" 배너. D3 실
  데이터 전환 시 자동 비활성 (`rawPayload.stub === false` 조건부, ADR-0013
  Amendment 1 §트리거 조건 — 이미 설계됨).

---

## Decision — D1~D5

> 본 D1~D5 는 **운영자 결정의 기록**이다. 각 결정은 ADR-0003 이 *의식적으로
> 좁혔던* 것을 운영자가 *의식적으로 다시 넓히는* 것이며, 그 트레이드오프는
> §Consequences 에 정직하게 명시된다.

### D1 — 공개 로케일 = EN/FR/NL, KO = 운영자 전용 hidden (basic-auth 게이트 — 잠금)

- **공개 로케일 (확정)**: `en` / `fr-BE` / `fr-LU` / `nl-BE` / `nl-NL`
  (CLAUDE.md §5 5 locale 중 ko 제외 4 언어군 = ADR-0033 §T2 `locales` 배열
  그대로 — 변경 0). ko 는 이 배열에 비포함 (ADR-0033 §T2 원칙 *유지*).
- **KO = 운영자 전용 hidden — 게이트 구현 = Next.js middleware basic-auth
  (운영자 잠금)**:
  - *개발·검증 작업 언어* (운영자가 한국어로 검증해야 개발 진행 가능 — 운영자
    원문). ko = 개발/검증 작업 언어, 공개 SEO 대상 아님.
  - **구현 = `src/middleware.ts` basic-auth 확장** (ADR-0033 §T1 기존 통합
    middleware 의 `/admin` 가드 패턴과 동형 — 운영자 ID/PW, **env 비밀 1개**).
    기존 admin 가드(`ADMIN_TOKEN` 쿠키/쿼리)와 *같은 middleware 단일점* 에서
    ko 접근을 게이트한다. 새 인증 라이브러리 0 / 새 SaaS 0 / 새 env 1개.
  - 공개 `locales` 배열 / hreflang / sitemap **비포함** (ADR-0033 §T2 의
    "ko 는 locale 아닌 콘텐츠" 원칙 *유지*, 운영 모델만 "베타 콘텐츠 언어"
    → "운영자 전용 게이트 언어" 로 *변경*).
- **KO 의 운명 (단 하나의 미결 — 운영자 명시 보류)**: 런칭/개발 완료 후
  KO 삭제 vs hidden 유지는 **그때 결정**. 본 ADR 은 이것만 미결로 남긴다
  (다음 단계 결정).
- **다음 단계 결정 (구현 상세 — 본 ADR 범위 밖) — 세그먼트 매핑 잠금
  완료 (2026-05-17, architect, [ADR-0033](0033-i18n-next-intl-introduction.md)
  §Amendment 2)**: 현 `src/i18n/routing.ts` 는 ko 를 `locales` 배열에
  *넣지 않고* defaultLocale(`nl-BE`) 슬롯에 `messages/ko.json` 을 채우는
  구조다 (ADR-0033 §T2). 본 ADR Accepted 시점엔 "basic-auth 게이트가 어느
  경로/세그먼트를 보호하는지 = builder 진입 시 결정 / 임의 결정 안 함"
  으로 명시 보류했다. **이 보류는 D1 진입 전 architect 가 ADR-0033
  §Amendment 2 §A2.2 에서 설계 결정으로 잠금 완료**: 옵션 (a) ko prefix
  추가 = ❌ (§T2 `locales` 변경 0 잠금 위반) / 옵션 (b) **채택** = nl-BE
  슬롯(ko 복제) 무변경 + middleware basic-auth 가 *locale prefix 없는 경로
  전체* 가드 (§T1/§T2 무변경, 회귀 0) / 옵션 (c) 별도 도메인 = ❌ (env
  1개/새 SaaS 0 잠금 초과 — 단 운영자 검증 UX 선호는 ADR-0033 §A2.4
  운영자 확인 항목). 구현 DoD = ADR-0033 §A2.5 (PLAN 4.5.j.1 본문 반영).
  본 ADR 의 D1 잠금값(`locales` 변경 0 / middleware basic-auth / env 1개 /
  기존 `/admin` 동형)은 옵션 (b) 가 100% 정합 — 잠금값 변경 0.
- **ADR-0033 SC-E 와의 관계**: ADR-0033 §T2 + ADR-0016 §T10 SC-E 의 *운영
  모델* 이 바뀐다. ADR-0033 §T1 라우팅 골격(`app/[locale]/`)은 **보존** —
  마이그레이션 회귀 0. 바뀌는 것은 (a) 베타가 ko 단일이 아니라 EN/FR/NL
  공개 (b) ko 가 "베타 콘텐츠" 가 아니라 "운영자 전용 basic-auth 게이트 콘텐츠".

### D2 — 페이즈 5 진입 게이트 (ADR-0003 §결정 2 4-신호) 제거 — 처음부터 동시 빌드

- ADR-0003 §결정 2 의 M16 4-신호 게이트(매출/CVR/fetcher 안정성/시간) **삭제**.
- 페이즈 5 ("M16 평가 후 결정") 의 *조건부* 성격 제거 — 다국어를 **처음부터
  동시 빌드** (운영자 "사이트 완성 할거고 완성 되면 사람 모을거야").
- **카테고리 범위 = 통신 BE 만 깊게 (운영자 잠금)**: "동시 빌드" 의 범위는
  **통신 BE 단일 카테고리 × 4 fetcher** 로 *확정*. 에너지 등 타 카테고리
  추가는 **❌ 범위 밖** (운영자 명시 거부). ADR-0003 §대안 B 의 "12 fetcher
  동시" 리스크는 *통신 단일 깊이* 로 부분 완화 (4 fetcher × 1 카테고리). 단
  4 fetcher × 실 스크래핑 × 4 공개 locale 동시 부담은 §Consequences 그대로
  잔존.
- ADR-0003 §결정 1 (통신 우선) / §결정 4 (페이즈 4 통합) / §결정 5 (M 단위
  일정) 는 *유지* — D2 는 §결정 2 (게이트) 만 무효화. §대안 B 의 거부 사유는
  *기술적으로 여전히 유효* — 운영자가 의식적으로 수용 (재맥락화, ADR-0003
  Amendment 1).
- **페이즈 5 잔여 카테고리 처리**: 에너지/모기지/보험/금융 등 PLAN 페이즈 5
  잔여 항목은 D2 범위 확정(통신만)에 따라 **"보류/범위 밖"** 으로 PLAN 에
  명시. 페이즈 5 의 *조건부* 게이트는 제거되나 *통신 외 카테고리* 진입은
  본 ADR 이 잠그지 않음 (별도 ADR 트리거 — 다음 단계 결정).

### D3 — 실 데이터: 1.5.6 차단(`[!]`) 해제, 스텁 "추정값" → 실 스크래핑 가격

- PLAN 1.5.6 `[!]` (ADR-0013 옵션 C, MEDIUM 2.75/5.0 으로 페이즈 5/6 차단)
  **차단 해제 → `[ ]`** (운영자 잠금). 실 스크래핑 fetcher 구현 진입.
- ADR-0013 의 MEDIUM 분류 *근거는 여전히 유효* — 법적 불확실성 (Proximus/
  Telenet GTC PDF 텍스트 추출 실패, Appendix A) + 솔로 시간 비용 3.5/5
  (셀렉터 깨짐 디버깅 sink). 운영자가 이 리스크를 *의식적으로 수용*하고
  진입한다. ADR-0013 **amend 확정**: 옵션 C → **"옵션 B 유사 진입 + 24h
  신선도 모니터링 게이트 복원 + GTC PDF 수동 열람 선행 (Appendix A §조건 A,
  운영자 트랙) + Orange BE/Voo robots.txt+TOS 신규 평가 (legal 트리거)"**.
  ADR-0013 MEDIUM 분류 근거 자체는 무효화하지 않음 (Deferred/HIGM 재분류
  아님 — 운영자 의식 수용).
- **실 스크래핑 legal 선행조건 (잠금)**: D4 4 공급사 진입 *전*, `legal`
  에이전트가 **Proximus/Telenet/Orange BE/Voo 4-provider robots.txt + TOS
  일괄 검토** 를 트리거 + 운영자가 **GTC PDF 수동 열람** 병행. 본 트리거는
  PLAN 1.5.6 선행조건 항목으로 박되, **해당 PLAN 항목 진입 시 legal 호출**
  (본 ADR 적용 턴에서는 legal 호출하지 않음 — 운영자 명시).
- **자동 정직성 배너 비활성 (추가 작업 0 — 설계 기존)**: 실 데이터 전환 시
  옵션 X "추정값" 배너 + caveat 규칙 9 가 자동 비활성
  (`rawPayload.stub === false` 조건부 — ADR-0013 Amendment 1 §트리거 조건 +
  PLAN 1.5.6.1 §재진입 트리거에 *이미 설계됨*). PLAN 1.5.6.1 은 본문 변경
  없이 cross-ref 1줄만 (추가 코드 0 — 설계가 이 전환을 예견함).
- **§8 #2 준수** — 스크래핑은 "그대로 가져오기" 만, 가격 변형 0.

### D4 — 공급사 깊이: Proximus + Telenet 2개 → Orange BE + Voo 추가 4개

- ADR-0009 (2 공급사, 좁고 깊은 포지셔닝, Orange BE 페이즈 5 이연)
  **deprecate** (전면 무효 — 4 공급사) → Proximus / Telenet / **Orange BE**
  / **Voo** 4 fetcher.
- `src/fetchers/orange-be.ts` + `src/fetchers/voo.ts` 신설 (ADR-0008
  인터페이스 그대로 — 인터페이스 변경 0, registry 배열 +2). 각 단위 테스트 1.
- **순서 = Orange BE 먼저 → Voo 차순 (운영자 잠금)**:
  - **Orange BE 우선** — BE 통신 시장 점유율 22.5% *검증됨* (Telecompaper
    Q1 2025, ADR-0009 §외부 사실). fetcher 신설 1순위.
  - **Voo 차순** — 점유율 *미검증*. Voo fetcher 신설 진입 시 **WebSearch
    리서치** 로 점유율/시장 위치 검증 후 진행 (다음 단계 — 해당 PLAN 항목
    진입 시).
- **per provider 재발 비용**: fetcher 2→4 = 스크래핑 위험 + 법적 검토
  (robots.txt/TOS) **신규 2 provider 분량** 재발. Orange BE / Voo 의
  robots.txt + GTC 는 ADR-0013 이 검토하지 않았음 → D3 §legal 선행조건의
  4-provider 일괄 검토에 포함 (Proximus/Telenet/Orange BE/Voo).

### D5 — 마케팅 피벗: ADR-0029 베타 모집 전면 deprecate → organic Google SEO

- ADR-0029 (한국인 시드 3채널 + 정직성 토큰 + PostHog Referrer + scope cut E
  + Amendment 1/2) **전체 deprecate 확정** (supersede 아님 — 모집 모델 자체
  폐기). T1~T6 + Amendment 1/2 전부 무효. 카피 4파일
  (`docs/marketing/beta-recruitment-copy.{kr,reddit,salair,tw}.md`) 각 상단
  DEPRECATED 헤더 (이력 보존 — 삭제 X).
- 신규 모델 (잠금): **사이트 완성 후 운영자가 직접 Google SEO / Search
  Console 로 organic 사용자 모집** (운영자 원문 "마케팅은 내가 알아서 할거야
  구글 seo serch consol 해서 사람 모을거야").
- **§정합 확인 — Google Search Console vs 헌법 §8 #1 (추적 0)**:
  - Search Console 은 *운영자가 자기 사이트의 검색 색인/순위/크롤 상태를
    보는 도구* — Google 이 *이미 공개 색인한 페이지* 의 집계 메트릭을 운영자에게
    보여줄 뿐, **Slim 이 사용자 데이터를 Google 로 전송하는 것이 아니다**.
    sitemap 제출 + 색인 요청은 *공개 URL 목록* 이지 PII 아님.
  - 결론: **헌법 §8 #1 위반 아님** (사용자 데이터 외부 전송 0). 단 본 ADR
    에 명기 — Search Console 연동은 (a) sitemap.ts 제출 (이미 ADR-0033/3.5.2
    존재) (b) DNS TXT 또는 HTML meta 소유권 검증 (PII 0) (c) 분석은 운영자
    대시보드 (사용자 식별 0) 만. Google Analytics 등 *클라이언트 추적 스크립트
    삽입은 본 ADR 범위 밖* — 도입 시 헌법 §8 #1 별도 위반 검토 (도입 안 함이
    기본).
- **hreflang/locale 대안 라우팅 = 이제 필수 (재개봉)**: PLAN 3.5.2 §범위 밖
  이 "hreflang/locale 대안 라우팅 (i18n 은 SC-E 로 페이즈 4 베타 직전 일괄 —
  현재 ko 단일이라 hreflang 무의미)" 으로 *명시적으로 닫았던* 것을 **재개봉**.
  다국어 공개 = nl-BE/fr-BE/nl-NL/fr-LU/en 각 고유 URL + `<link rel="alternate"
  hreflang>` + sitemap 다국어 항목이 organic SEO 의 *전제* (ADR-0033 §T1
  근거 — Google 은 locale variant 색인에 고유 URL + hreflang 요구).

---

## Amendment 1 (2026-06-04) — D4 정정: 4 → 3 fetcher (Voo 흡수)

### Context — 누락된 외부 사실

D4 결정(2026-05-17)은 Voo 를 *독립 공급사* 로 가정했다. 본 가정은 **2025-10-01
완료된 Voo-Orange Belgium 합병** 을 누락 — 결정 시점 architect 가 WebSearch
수행 부재. legal 에이전트가 2026-06-04 4-provider 점검 도중 발견 + WebSearch
10개 출처 교차 검증으로 사실 확정:

- **합병 완료 시점**: 2025-10-01 (VOO S.A. 주주 만장일치 승인 → 법인 소멸,
  Orange Belgium Group 흡수).
- **합병 경과**: 2023-06 Orange Belgium 의 75% 지분 인수 시작 → 2025-10-01
  잔여 25% + 법인 해산 완료.
- **브랜드/고객**: VOO 브랜드 + 기존 요금제는 *고객 영향 0* 으로 유지
  (Orange 의 명시 정책). 2026 년 동안 시스템 마이그레이션 진행 예정.
- **가격 페이지 현황** (legal 2026-06-04):
  - `voo.be/fr/internet` = "Nos prix à partir du 1 Janvier 2026 [PDF]" 안내,
    **정적 HTML 가격 부재**.
  - `voo.be` 모바일 가격 페이지 = 유효 URL 미발견.
  - `voo.be` 도메인 자체는 운영 중이나 가격 구조는 Orange 통합 진행 중.
- **점유율 정정**: ADR-0034 §Consequences §"얻는 것" 의 "BE 시장 ≥ 97% 점유
  추정 (Proximus 43 + Telenet 32 + Orange BE 22.5 + Voo)" 수치는 *합병 전*
  가정. **합병 후 Mordor Intelligence Q1 2025 = Orange Belgium + Voo 합산
  22.5%** (Voo 별도 보고 종료). 새 합산 추정 = Proximus 43 + Telenet 32 +
  Orange BE 합산 22.5 = **≥ 97.5%** (수치 자체는 ADR-0009 §외부 사실 기준,
  D4 의 시장 대표성 주장은 유지 — Voo 가 별도 25% 가 아니라 Orange 의 22.5%
  내부에 *이미 포함*).

### Decision — D4 정정 잠금값

1. **공급사 = Proximus + Telenet + Orange BE (3 fetcher)**. Voo 별도 fetcher
   **취소** (PLAN 1.5.9 삭제). `src/fetchers/voo.ts` + `voo.test.ts` 신설
   계획 폐기.
2. **Orange BE fetcher 범위 = `orange.be` 가격 페이지 + 합병 후 Voo 잔존
   가격 페이지 (있을 시) 흡수**. 구체 URL 셋은 builder 단계 첫 fetch 정찰로
   확정 (architect 가 잠그지 않음 — 합병 마이그레이션이 2026 년 진행 중이라
   URL/redirect 가 가변). 후보:
   - `orange.be/fr/...` (현 Orange 가격 페이지)
   - `voo.be/fr/internet` 등 (Voo 잔존 페이지가 Orange 통합 페이지로 redirect
     하는지 / 독자 페이지로 잔존하는지 builder 정찰).
3. **Voo 점유율 WebSearch (구 1.5.9 선행조건) = 불필요**. Voo 별도 시장 보고
   종료. Orange BE 점유율 22.5% 가 합산 수치 (legal 2026-06-04 + Mordor Q1
   2025 = 검증된 사실).
4. **legal 4-provider 트리거 = 3-provider 로 축소**. Voo robots.txt + TOS
   별도 평가 불필요 (legal 이 이미 ADR-0013 Appendix B §B.4 에서 통과로
   기록했으나, fetcher 가 없으므로 적용 대상 없음 — 역사적 기록은 보존).
5. **1.5.6 통과 시 잠금된 옵션 X 자동 비활성 트리거** = Orange BE 단일
   완성 시 발화 (구 4 fetcher 모두 완성 조건 → 3 fetcher 모두 완성).
6. **ADR-0009 deprecate 결정 = 유지**. 2 공급사 모델은 여전히 무효 (3 공급사
   확장이 본 결정). ADR-0009 §결정 1 "Orange BE 페이즈 5 이연" 의 무효는
   유지 (D4 가 1.5.8 로 당겨옴).

### Consequences — 정정의 트레이드오프

#### ✅ 얻는 것

- **정직성 복원** (CLAUDE.md §2 / §3 P3) — 존재하지 않는 법인(Voo S.A.) 을
  fetcher 화 하지 않음. ADR-0034 본문이 합병 완료 5개월 후에도 "Voo 독립"
  을 전제하는 것은 P3 거짓 신호.
- **솔로 부담 ↓** — fetcher 4 → 3 = ADR-0034 §Consequences §"잃는 것"
  ADR-0003 §대안 B 거부 사유 재현 강도 부분 완화 (4 → 3 fetcher × 4
  locale × 실 스크래핑). per-provider 재발 비용 1건 감소 (Voo
  robots/TOS/GTC/셀렉터 디버깅 부담 0).
- **시장 대표성 보존** — 합산 점유율 ≥ 97.5% (Proximus 43 + Telenet 32 +
  Orange BE 합산 22.5) 는 합병 전 *Voo 별도 포함* 가정과 *동일 수준* 으로
  유지 (Voo 가 Orange 내부로 흡수되었기 때문).
- **운영 부채 ↓** — 1.5.9 항목 (deferred 또는 별도 트랙) 잔존 시 미래
  WebSearch 재평가 부담 발생 → 취소로 해소.

#### ⚠️ 잃는 것 / 부채

- **Orange BE fetcher 책임 확장** — Orange BE 단일 fetcher 가 *합병 후 Voo
  가격 페이지까지* 흡수. 운영 중인 마이그레이션 (2026 년 진행) 동안 URL 변경
  / redirect / 페이지 통합 시점이 가변 → 셀렉터 깨짐 회귀 빈도 ↑ 가능.
  builder 정찰 + manual 폴백 (`method='manual'`) 가 안전망.
- **Voo 브랜드 가격 별도 노출 불가** — 비교 결과에 "Voo X 요금제" 라벨이
  Orange BE fetcher 산출물 안에 *Orange 라벨* 로 표시될 가능성. 사용자가
  "Voo 가 비교 대상에 있는가?" 묻는 경우 §정직성 답변 필요 (UI 캐비엇
  또는 `/data-sources` 페이지에 "Voo 는 2025-10 Orange Belgium 에 합병되어
  Orange BE fetcher 범위에 포함" 1줄 — builder 후속).
- **ADR-0034 §Consequences §"잃는 것" #1 (ADR-0003 §대안 B 재현) 강도 ↓ 하나
  잔존** — 3 fetcher × 4 locale × 실 스크래핑 동시 빌드 부담은 4 → 3 로
  *경감*. 단 "M16 4-신호 게이트 제거 (D2)" 의 구조적 안전망 상실은 *변경 0*.

### 영향 — PLAN.md / 다른 ADR

- **PLAN 1.5.9 삭제** (취소). 본 Amendment 가 단일 출처.
- **PLAN 1.5.8 본문 갱신** — Orange BE fetcher 범위에 "합병 후 Voo 잔존
  가격 페이지 흡수" 원칙 명시. 구체 URL = builder 정찰.
- **PLAN 4.7 본문 갱신** — "4 fetcher" → "3 fetcher" (Proximus/Telenet/
  Orange BE).
- **PLAN 1.5 행 + 합계 표** — 항목 수 10 → 9 / 합계 93 → 92.
- **ADR-0013 §legal 트리거 4-provider** = 3-provider 로 축소 cross-ref
  (ADR-0013 본문 변경은 PR #17 트랙 — 본 Amendment 는 cross-ref 만).
- **ADR-0009 deprecate** = 유지 (변경 0).
- **INDEX.md** — ADR-0034 행에 "Amendment 1 (2026-06-04 — D4 정정)" 표기.

### 검증 방법

1. **PLAN harness:plan 합계 정합** = 93 → 92 / done 64 불변 / 차단 0 불변.
2. **1.5.8 진입 시 Orange BE fetcher 첫 fetch** = orange.be 가격 페이지 +
   voo.be 가격 페이지 (redirect 또는 잔존) 양쪽 정찰 → URL 셋 확정 (builder).
3. **운영자 거부 트리거** — 운영자가 "Voo 별도 트래킹 필요" 결정 시 본
   Amendment amend (Voo 별도 fetcher 재개 또는 manual 트랙). 본 Amendment 는
   architect 가 *합리적 외부 사실 기반* 자율 결정 = 운영자 reject 가능.

---

## Alternatives Considered (운영자가 거부한 것 — 거부 사유 = 운영자 결정)

> 아래 대안들은 architect 가 "더 안전하다" 고 평가하는 것들이다. 운영자가
> *의식적으로 거부*했음을 기록한다. architect 는 트레이드오프를 표면화하되,
> 결정 권한은 운영자에게 있다 (CLAUDE.md §2 — 혼자 다 하지 않는다 / §4).

### 대안 A — 베타 게이트 유지 (ADR-0003 §결정 2 보존)

- **architect 평가**: 가장 안전. M16 4-신호가 "잘못된 방향에 솔로 시간 매몰"
  을 구조적으로 차단. ADR-0003 §대안 B·§검증 2 의 안전 메커니즘.
- **거부 (운영자 결정)**: 운영자가 "사이트 완성 후 organic 모집" 을 택함 —
  검증 게이트보다 *완성된 제품으로 SEO 진입* 을 우선. 운영자가 4-신호 게이트
  없이 진행하는 리스크를 의식적으로 수용.

### 대안 B — 단계적 다국어 (ADR-0033 시나리오 γ 유지: ko 베타 → 4.9 nl/fr/en backfill)

- **architect 평가**: 회귀 표면적 분산 (베타 전 ko / 런치 게이트 nl/fr/en).
  ADR-0033 §Consequences §"얻는 것" 의 일정 리스크 ↓ 논거.
- **거부 (운영자 결정)**: 운영자가 "영어 네덜란드어 프랑스어로 만들면서
  검증하면 하나하나 내가 완성 할거야" — 다국어를 *완성 과정의 일부* 로 동시
  진행. ko 는 검증 언어로 hidden 게이트 뒤로 (D1).

### 대안 C — 스텁 런치 (ADR-0013 옵션 X "추정값" 으로 런치)

- **architect 평가**: 법적/시간 리스크 최저 (ADR-0013 MEDIUM 차단 유지).
  옵션 X 배너로 P3 정직성 유지 가능 (ADR-0013 §평가 6).
- **거부 (운영자 결정)**: organic SEO 로 모은 사용자에게 "추정값" 제시는
  제품 신뢰 약함 — 운영자가 실 데이터 전환을 택함. ADR-0013 MEDIUM 리스크
  (법적 불확실 + 솔로 디버깅 sink)를 의식적으로 수용.

### 대안 D — 2 공급사 유지 (ADR-0009 좁고 깊은 포지셔닝)

- **architect 평가**: 솔로 디버깅 부담 최저 (fetcher 깨짐 빈도 ∝ 갯수,
  ADR-0009 §Consequences). BE ≥ 75% 점유로 시장 대표성 충족.
- **거부 (운영자 결정)**: 운영자가 4 공급사로 비교 깊이 확대를 택함. fetcher
  2→4 = 스크래핑 위험·법적 검토 per provider 재발 (ADR-0009 §대안 A 거부
  사유 재현)을 의식적으로 수용.

### 대안 E (architect 추가) — 피벗 자체를 점진 적용 (D1→D3→D4→D5 순차) — **채택 (운영자 잠금)**

- **architect 평가**: D1(ko basic-auth 게이트)만 먼저 → D3(실데이터) →
  D4(4공급사) → D5(SEO) 순차 적용 시 각 단계 회귀 격리. 솔로 + €300 cap 정합.
- **운영자 결정 = 순차 채택 (확정)**: D1~D5 의 *최종 목표* 는 동시 빌드(베타
  게이트 없는 완성)이나, *적용 순서* 는 **순차 D1 → D3 → D4 → D5** 로 잠금
  (회귀 격리). PLAN 재구조화도 이 순서를 트랙으로 반영. 즉 본 ADR 의 결정은
  "동시 빌드를 목표로 하되 순차로 적용" — 대안 E 를 architect 가 단독
  결정한 것이 아니라 운영자가 명시 채택.

---

## Consequences

### ✅ 얻는 것

- **완성된 제품으로 organic 진입** — 스텁/베타 게이트 없이 EN/FR/NL 공개 +
  실 데이터 → SEO 색인 자산 (ADR-0033 §T1 hreflang 정합 + 헌법 P1·P2).
- **다국어 SEO 자산 확보** — hreflang/locale 라우팅 재개봉 (D5) → 베네룩스
  검색 노출 (ADR-0033 §T1 가 이미 라우팅 골격 배선 — 회귀 0, 콘텐츠 backfill만).
- **실 데이터 P1 강화** — 스텁 "추정값" → 실 스크래핑 (헌법 P1 정보 우선
  강화). 옵션 X 배너 자동 비활성은 *설계가 이미 예견* (추가 코드 0).
- **비교 깊이 ↑** — 4 공급사 (BE 시장 ≥ 97% 점유 추정: Proximus 43 +
  Telenet 32 + Orange BE 22.5 + Voo — ADR-0009 §대안 A 의 "≥97%" 수치).
- **KO 검증 워크플로 보존** — 운영자가 한국어로 검증하며 개발 지속 (운영자
  원문 핵심 요구) — D1 게이트가 이를 구조적으로 보장.
- **마케팅 부담 운영자 이관** — ADR-0029 한국인 시드 모집 운영(채널 4개
  daily check 등)에서 운영자 해방, SEO 는 sitemap 이미 존재(3.5.2).

### ⚠️ 잃는 것 / 부채 (절대 숨기지 않음 — Pieter 는 사용자에게 거짓말 안 한다)

- **⚠️⚠️ ADR-0003 §대안 B 거부 사유 재현 (최대 리스크)** — 솔로 8h/주 +
  €300 cap 에서 **멀티(범위는 §D) × 4 공급사 × 4 공개 로케일 × 실 스크래핑
  동시 빌드**. ADR-0003 §대안 B 가 "솔로에서 fetcher 다수를 동시에 만드는
  것은 불가능. 검증 안 된 곳에 시간 매몰 = 회복 불가" 라고 *명시적으로
  거부*했던 정확히 그 형태다. 본 ADR 은 그 리스크가 *사라졌다고 주장하지
  않는다* — 운영자가 리스크를 알고 선택했음을 기록할 뿐이다. 구체 재현 벡터:
  - fetcher 4 × 실 스크래핑 = 셀렉터 깨짐 디버깅 부담 ADR-0013 §솔로 시간
    비용 3.5/5 × 2배 (2→4 공급사). Cheerio 학습 + 차단 우회 학습 (운영자
    arbitoria.com Reddit/FB 광고 차단 사전 학습 — ADR-0013 §Context).
  - 4 공개 locale 콘텐츠 backfill (DeepL Free + 수동 검수, ADR-0033 §T3) +
    `legal.*` legal 에이전트 게이트 (ADR-0033 §T4) 가 *베타 전이 아니라
    런치 전 동시* 발생.
  - M16 4-신호 게이트 제거(D2) = "잘못된 방향 매몰" 의 구조적 안전망 상실.
    검증은 organic 트래픽 사후 신호로만 (선제 게이트 0).
- **⚠️ ADR-0013 법적 불확실성 미해소** — Proximus/Telenet GTC PDF 텍스트
  추출 실패 (Appendix A) 잔존. Orange BE / Voo 의 robots.txt + TOS 는
  *미검토* (ADR-0013 범위 밖). D4 진입은 legal 트리거 필수 (§D). CJEU
  Ryanair 판례 (상업적 가격비교 스크래핑) 적용 가능성 ↑ (organic 사용자 =
  상업 운영 신호, ADR-0013 Appendix A §조건 C).
- **⚠️ ADR-0029 deprecate = 베타 피드백 신호 0** — 한국인 시드 ≤50명 정성
  피드백 (NPS/마찰점) 단계가 사라짐. organic SEO 는 트래픽이 *지연* 발생
  (색인 수주~수개월) + 초기 표본 적음 → 제품 결함을 *사용자가 먼저 발견*
  할 위험 (ADR-0029 §Consequences 의 "베타 = 비공개 사전 운영" 안전 장치 손실).
- **⚠️ €300 cap 압박 (DeepL/Vercel/Neon)** — 4 locale × 콘텐츠 = DeepL Free
  500K 자/월 한도 (ADR-0033 §T3 — 분량 미측정 시 초과 가능). organic 트래픽
  증가 시 Vercel Hobby commercial-use 금지 → Pro $20/mo (ADR-0024 §R2 /
  ADR-0020 §회귀 #6) + Neon Free 한도 (ADR-0024 §R7). ADR-0004 €300 cap
  재평가 트리거 (별도 Amendment 후보).
- **⚠️ KO 게이트 보안 표면 신설** — D1 operator-only gate 구현 (basic-auth/
  env/preview token — §D) 이 *새 인증 코드 경로*. 잘못 구현 시 KO 콘텐츠
  (개발 중 미완성 텍스트) 공개 노출 = P3 신뢰 손상. 게이트 누수 = 회귀 트리거.
- **⚠️ 다수 Accepted ADR 의 supersede/amend 부채** — §Blast Radius 의 10
  ADR 정합 작업 (scribe/builder 후속 턴). INDEX.md + PLAN.md 대규모 재구조화.

### 🔁 회귀 트리거

1. fetcher 4 중 1개 첫 실 fetch 차단 (HTTP 403/429/챌린지) → ADR-0013
   Amendment (HIGH 재분류) + 해당 fetcher 비활성 + 운영자 보고.
2. KO 게이트 누수 (비운영자 ko 콘텐츠 접근 1건) → 게이트 구현 즉시 재설계.
3. DeepL Free 500K 자 초과 → ADR-0033 §T3 분할 전략 또는 Pro (M16 매출 시).
4. Vercel Hobby commercial 한도 / Neon Free 한도 도달 → ADR-0004 + ADR-0024
   §R2/R7 격상.
5. Proximus/Telenet/Orange BE/Voo cease & desist 또는 법적 접촉 →
   ADR-0013 Appendix A §조건 B 외부 변호사 즉시 (ADR-0004 €800).
6. organic 트래픽 0 (3개월+ 색인 후) → 마케팅 모델 재평가 (SEO 단독 부족 시
   별도 ADR — ADR-0029 deprecate 의 역트리거).

---

## Verification

본 ADR Accepted (2026-05-17) — architect 가 본 턴에서 블래스트 반경 +
PLAN 재구조화를 일괄 적용. typecheck/lint/test/harness:plan = verifier 후속.

1. **운영자 잠금 ✅ 완료 (2026-05-17)** — D1~D5 + 잔여 결정 전부 명시 잠금:
   KO 게이트 방식 = **middleware basic-auth + env 1개** / 순서 = **Orange BE
   → Voo** / legal 트리거 = **D4 진입 전 4-provider robots+TOS 일괄 + GTC
   수동** / 카테고리 범위 = **통신 BE 만** / 적용 순서 = **순차 D1→D3→D4→D5**.
   미결 1건 = KO 운명(런칭 후 삭제 vs 유지) — 운영자 명시 보류.
2. **블래스트 반경 적용 ✅ (architect, 본 턴)** — §Blast Radius 의
   amend(6: 0003/0004/0013/0016/0023/0033) + deprecate(2: 0009/0029) + 카피
   4파일 DEPRECATED + INDEX.md 행 갱신.
3. **PLAN.md 전면 재구조화 ✅ (architect, 본 턴)** — §References 의 PLAN
   재구조화 제안 적용 (C-1~C-5). `pnpm harness:plan` 합계 정합 = verifier
   검증. **€300 cap 정책 = 유지** (ADR-0004 amend — D3/D4/D5 인프라 압박 시
   §회귀 트리거 조기 발화 → Amendment 재평가, 본 ADR 에서 cap 변경 X).
4. **i18n 4 locale 검증** — `pnpm dev` → nl-BE/nl-NL/fr-BE/fr-LU/en 콘텐츠
   존재 + hreflang `<link>` + sitemap 다국어 항목. ko = 게이트 뒤 (비공개
   접근 시 403 또는 미노출).
5. **실 데이터 검증** — 4 fetcher 실 Neon DB `tariff_snapshot` 누적 +
   `rawPayload.stub === false` → 옵션 X 배너 자동 비활성 (ADR-0013 Amd 1).
   confidence='low' 비율 < 20%.
6. **헌법 정합** — P1 (실 데이터 source/fetched_at) / P2 (4 fetcher + 4
   locale 부하 LCP ≤ 2.5s, ADR-0023 harness:perf) / P3 (KO 게이트 + SEO
   추적 0) / P4 (typecheck 0) / §8 #1 (Search Console PII 0 §D5) / §8 #2
   (스크래핑 가격 가공 0).

---

## Blast Radius — 영향받는 ADR 판정

> 본 표는 운영자 승인(2026-05-17) 후 architect 가 본 턴에 적용 완료한 판정이다.
> 각 ADR §Status / INDEX.md 행에 amend/deprecate 반영 (P5 정합 — 본문 외과
> 수정, 본문 전면 재작성 0). 적용 결과 = §Status 헤더에 Amendment/DEPRECATED
> 헤더 추가, INDEX.md 행 갱신, 카피 4파일 DEPRECATED 헤더.

| ADR | 판정 | 근거 (1~2줄) |
|---|---|---|
| **ADR-0003** | **amend** (supersede 아님) | §결정 2 (M16 4-신호 게이트) 무효화 (D2) + §대안 B 거부 사유 "운영자 의식적 수용" 으로 재맥락화. §결정 1·4·5 (통신 우선 / 페이즈 4 통합 / M 단위) 는 *유지* → 전체 supersede 가 아니라 §결정 2 한정 amend. |
| **ADR-0004** | **amend** | €300 cap 자체는 유지. 단 D3/D4/D5 (실 스크래핑 + 4 fetcher + 4 locale DeepL) 가 인프라 압박 (Vercel Pro/Neon/DeepL) 가속 → §회귀 트리거 ("분기 ±50%") 조기 발화 가능. cap 재평가 Amendment 후보 (운영자 확정). |
| **ADR-0009** | **deprecate** (→ ADR-0034 D4 로 대체) | "2 공급사 (Proximus+Telenet), Orange BE 페이즈 5 이연" 의 핵심 결정 1 이 정면 무효 (D4: 4 공급사). §결정 2 (페이즈 1 일정) / §검증 (M16 게이트) 도 D2 로 무의미. 좁고 깊은 포지셔닝 자체 폐기 → deprecate 가 정직 (amend 는 결정 1 잔존 오해 소지). |
| **ADR-0013** | **amend** (옵션 C → 진입) | MEDIUM 2.75/5.0 *분류 근거는 유효* (법적 불확실 + 솔로 시간 3.5). 운영자가 차단 해제(D3) → §분기 권장 옵션 C → "옵션 B 유사 진입 + 24h 모니터링 게이트 복원 + GTC PDF 수동 열람 선행(Appendix A §조건 A) + Orange BE/Voo robots/TOS 신규 평가" 로 amend. Deferred/HIGH 아님 — 운영자 의식 수용. |
| **ADR-0016** | **amend** (§T10 SC-E 재정의) | §T10 SC-E ("페이즈 4 까지 한국어 단일") 의 *운영 모델* 변경 — 베타 = ko 단일 → EN/FR/NL 공개 + ko 게이트. §T1~T9 (라우팅/입력 플로우 UI) 는 *무관* (보존). ADR-0033 이 이미 SC-E "발동+앞당김" Amendment 1 → 본 ADR 이 SC-E 를 "ko=운영자 게이트, 4 locale 공개" 로 재정의 (Amendment 2 후보). |
| **ADR-0021** | **무관 (영향 경미)** | 페이즈 3 결과 페이지 3층 구조 / `/api/compare` / caveats UI 는 피벗과 직교. **단 §T8 `/r/[shortId]` `robots:{index:false}` (noindex) 는 유지** — 개별 결과는 PII 파생물, organic SEO(D5)는 *색인 대상 라우트* (`/`, `/compare`, `/data-sources` 등) 대상이지 개별 결과 아님. noindex 정책 변경 0. cross-ref 1줄만 (D5 SEO ≠ /r/ 색인). |
| **ADR-0023** | **amend** (perf 예산 재검증) | §T4 임계값 (LCP ≤ 2.5s hard / first-load JS per-route 2-tier) 정책 유지. 단 4 fetcher (서버측 — 클라 번들 무관) + **4 locale 라우팅 (next-intl middleware + locale별 메시지 번들)** 가 first-load JS / LCP 에 영향 가능 → §T3 측정 페이지 셋에 locale prefix 반영 + 베이스라인 재측정 필요. 임계값 자체 변경 0, 측정 범위 amend. |
| **ADR-0026** | **무관 (정합 확인 완료)** | 어트리뷰션 (`affiliate_click` + `?ref=` + 동의 흐름)은 SEO 피벗(D5)과 *컨텍스트 분리* — ADR-0029 §T5 가 이미 "모집 도착 ≠ 제휴 클릭" 명문화. organic SEO 사용자도 비교 → 제휴 클릭 시 ADR-0026 흐름 동일 적용. §T7 `?ref=` 는 SEO 와 무관. 추적 0 정신 정합 (D5 §정합 확인). 변경 0. |
| **ADR-0029** | **deprecate (전체)** | 한국인 시드 3채널 모집 모델 자체 폐기 (D5: organic SEO). T1~T6 + Amendment 1/2 전부 무효. 카피 4파일 (`docs/marketing/beta-recruitment-copy.*.md`) DEPRECATED 헤더 (이력 보존, scribe — 삭제 아님). PLAN 4.6 베타 모집 절 재구조화. |
| **ADR-0033** | **amend** (시나리오 γ → 4 locale 공개 + ko 게이트) | §T1 라우팅 골격 (`app/[locale]/` + middleware) **보존 — 회귀 0** (이게 핵심 자산). §T2 ("ko = 베타 콘텐츠 언어, 4.9 backfill") 운영 모델 변경: ko = 운영자 게이트 콘텐츠 / nl·fr·en backfill 이 *4.9 런치 게이트 → 완성 동시* 로 당겨짐. §T3 (DeepL) / §T4 (legal.*) / §T5 (키화 우선순위) 는 *유지*, 시점만 당김. §SCOPE 표 + §Verification #6 (4.9 게이트) 재정의 = Amendment 2 후보. |

**INDEX.md 영향**: 위 10 ADR 행의 Status 셀 갱신 + 본 ADR-0034 신규 행 추가
(운영자 승인 후 scribe). ADR-0009/0029 는 "Deprecated (ADR-0034, YYYY-MM-DD)"
표기.

---

## References

### 헌법 + 운영자 컨텍스트
- [`CLAUDE.md`](../../CLAUDE.md) — §2 (Pieter 페르소나 — 거짓말 안 함),
  §3 P1 (정보 우선), P2 (LCP/시장), P3 (투명성), P4 (타입 안전), P5 (ADR),
  §5 (i18n=next-intl 5 locale), §8 #1 (사용자 데이터 외부 0), #2 (가격 가공 0)
- 운영자 결정 원문 (2026-05-17, 대화 컨텍스트) — "계획 전면 수정 / 사이트
  완성 후 organic Google SEO / 영어·네덜란드어·프랑스어 동시 / ko = 편집자
  모드 hidden 검증 언어"
- [`docs/FOUNDER.md`](../FOUNDER.md) — 솔로 사이드, 주 8~20시간, €300 cap,
  한국어 모국어, TVA 대기

### 관련 ADR (블래스트 반경 — §Blast Radius 표 참조)
- [ADR-0003](0003-plan-realism-solo-side.md) §결정 2·§대안 B (게이트/동시
  빌드 거부 — D2 가 무효화, 운영자 의식 수용)
- [ADR-0004](0004-monetization-solo-side-rebalance.md) §결정 2 (€300 cap —
  D3/D4/D5 압박)
- [ADR-0009](0009-scope-cut-fetcher-2-providers.md) §결정 1 (2 공급사 —
  D4 가 deprecate)
- [ADR-0013](0013-fetcher-real-scraping-risk-assessment.md) §분기 권장 옵션
  C + Appendix A (법적 불확실 — D3 가 amend) + Amendment 1 (옵션 X 자동 비활성)
- [ADR-0016](0016-phase-2-input-flow-design.md) §T10 SC-E (한국어 단일 —
  D1 재정의)
- [ADR-0021](0021-phase-3-results-page-design.md) §T8 (`/r/[shortId]`
  noindex — D5 와 직교, 유지)
- [ADR-0023](0023-lighthouse-axe-perf-harness.md) §T3/§T4 (perf 예산 —
  4 locale 부하 재측정)
- [ADR-0026](0026-affiliate-click-and-attribution.md) §T7 (`?ref=` — SEO 와
  컨텍스트 분리, 무관)
- [ADR-0029](0029-beta-recruitment.md) 전체 + Amendment 1/2 (D5 가 deprecate)
- [ADR-0033](0033-i18n-next-intl-introduction.md) §T1 (라우팅 골격 — 보존,
  핵심 자산) / §T2~T5·§SCOPE (시나리오 γ — D1·D5 가 amend)

### 외부 사실 (검증된 출처)
- [Google — Localized versions / hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
  — 다국어 색인 = 고유 URL + hreflang (D5 전제, ADR-0033 §T1 인용)
- [Google — Search Console 개요](https://support.google.com/webmasters/answer/9128668)
  — Search Console = 자기 사이트 색인/순위 메트릭 (사용자 데이터 전송 아님 —
  D5 §정합 확인, ※ architect 가 §D5 에 명기, 운영자 승인 시 WebFetch 검증 권장)
- ADR-0009 §외부 사실 — Telecompaper Q1 2025 (Proximus 43 / Telenet 32 /
  Orange BE 22.5%). **Amendment 1 정정 (2026-06-04)**: Voo 별도 점유율은
  Voo-Orange Belgium 합병 (2025-10-01) 후 보고 종료. Orange BE 22.5% =
  Mordor Intelligence Q1 2025 기준 *합산 수치* (Voo 포함).
- ADR-0013 §External facts — Proximus/Telenet robots.txt (요금제 페이지 차단
  X) + Appendix A (GTC PDF 추출 실패). Orange BE/Voo robots.txt+TOS =
  Appendix B (legal 2026-05-17) 통과 기록. **Amendment 1 (2026-06-04)**:
  Voo 별도 fetcher 취소 → Voo robots/TOS 별도 적용 대상 없음 (역사 기록 보존).
- [ITdaily — Merger of Orange Belgium and Voo Officially Completed](https://itdaily.com/news/network/orange-belgium-voo-merge/)
  — Voo-Orange 합병 2025-10-01 완료, VOO S.A. 법인 소멸 (Amendment 1
  외부 사실).
- [Orange Belgium corporate — VOO acquisition final step](https://corporate.orange.be/en/node/58036)
  — VOO S.A. fully integrated in Orange Belgium Group, VOO 브랜드/요금제는
  고객 영향 0 유지, 시스템 마이그레이션 2026 진행 (Amendment 1 외부 사실).
- [Brussels Times — Orange Belgium completes acquisition of VOO](https://www.brusselstimes.com/533884/orange-belgium-completes-acquisition-of-voo)
  — 인수 경과 보도 (Amendment 1 cross-check).
