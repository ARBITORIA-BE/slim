# ADR-0029: Beta recruitment — channels + honesty + tracking + scope cut

## Status

**Accepted** (2026-05-13 — 운영자 직접 결정 / architect 권고).

---

## Context

- **PLAN §4.6** — "베타 모집 100명" (또는 scope cut 옵션 E에 따라 50명)
- **무엇이 우리를 이 결정 앞에 세웠는가:**
  1. **투명성 우선 (헌법 P3)** — "최고", "유일", "혁신" 과장 금지. "현재 2개 공급사 깊이 비교 중" 정직성 강제.
  2. **추적 최소화 (헌법 §8 #1)** — 베타 신청 URL에 UTM 파라미터 0, PII 수집 0 (옵션 나 채택).
  3. **scope cut E** — 솔로 + €300 cap 일관성 (MONETIZATION §결정 2 참고). 3주 후 누적 ≤50명이면 50명 목표로 마감.
  4. **정책 결정의 명확성** — "왜 Orange BE 제외하는가" 공개 (ADR-0009 일관 + `/data-sources` CTA).
  5. **피드백 채널 명시** — 4개 모집 채널 → 피드백은 3 채널 (이메일/댓글/GitHub).

---

## Decision

T1~T6 6개 결정.

### T1 — 모집 채널 4개

#### (1) Korean Society BE/NL/LU (한국어, Facebook/카카오톡)
- 대상: 베네룩스 거주 한국인 커뮤니티
- 길이: 500~800자 (한국어)
- 톤: 정직 + 한계 명시 + 베타 비공개 성격 설명
- 운영자 작업: 직접 복사·붙여넣기 또는 서포터 요청

#### (2) Reddit r/belgium (영어 또는 영어+네덜란드어)
- 대상: Belgian tech / expat community
- 길이: 200~400자 (영어 또는 기타 언어, subreddit rules 운영자 확인)
- 톤: Humble, self-promotional rules 존중
- 운영자 작업: subreddit 자가 광고 정책 확인 후 posting (규칙 위반 스팸 표시 회피)

#### (3) salair-plus.com (한국어, banner/footer)
- 대상: 운영자 기존 자산 (기존 프로젝트 salair-plus.com 사용자 cross-promotion)
- 길이: 1~2줄 (한국어 banner copy)
- 톤: 간결 + slim.lu 직접 링크
- 운영자 작업: 웹사이트 배너/footer에 직접 HTML/텍스트 삽입 (운영자 보유 사이트 권한)

#### (4) 한국어 트위터/스레드 (280자 또는 500자)
- 대상: 한국어권 tech/커뮤니티 계정
- 길이: 280자 (트윗) 또는 500자 (스레드 1번째 포스트)
- 톤: (1)의 짧은 버전 — 정직성 유지
- 운영자 작업: Slim 공식 계정 (또는 운영자 개인 계정) 직접 포스팅

### T2 — 정직성 잠금 토큰 (모든 카피에 필수)

다음 4개 토큰이 **전체 카피 4개에 모두 포함** 되어야 함 (각 채널별 카피 검증 체크리스트):

1. **"BE 시장 ≥75% 점유 2개 공급사만 비교 (Proximus + Telenet)"** + **"Orange BE/Voo는 포함되지 않음"** (ADR-0009 명시)
2. **"솔로 신생 사이트"** (founder 신뢰도 설정, 과장 회피)
3. **"베타 = 비공개 사전 운영, 데이터 수집 목적"** (유료화 과정 명시, 기대 조정)
4. **"무료, 광고 0, 어트리뷰션 100% 공개 (`/legal/affiliate-disclosure`)"** (헌법 P3 + ADR-0026 수수료 정합)

### T3 — 과장 금지 토큰 (모든 카피에서 0건)

다음 단어는 모든 4개 카피에서 **절대 사용 금지** (architect 잠금):

- "최고" / "최상의" / "가장 좋은"
- "유일" / "유일한"
- "혁신적" / "혁신"
- "AI" / "머신러닝" (tech jargon 과장)
- "가장 빠른" / "가장 저렴한" (무조건적 우위 주장 금지)
- "100% 절약 보장" / "무조건 저렴" (불가능한 약속)
- "지금 바로" / "지금만" (fake urgency)
- "대부분이" / "모두가" (사실 부정 수량 표현)

**CMA Dark Pattern + UCPD 정합**: 사이트 진실(2개 공급사)과 사용자 인식 갭 금지. 광고가 암시하는 기대 = 실제 서비스 범위.

### T4 — 베타 신청 채널 = 옵션 (나): 폼 없음, slim.lu 직접 방문

**결정**: 별도 `/beta-signup` 폼 **미생성** (PII 수집 최소화, 헌법 §8 #1 우선).

**흐름**:
1. 모든 4개 모집 카피 → `https://slim.lu` 단순 도메인 링크
2. 사용자 방문 후 비교 시도 = 자동 베타 참여 신호 (PostHog cookieless 방문자 수)
3. **PII 수집 0** — 이메일/이름/선택지 폼 없음
4. **추적 0** — 운영자 측 신호 = PostHog Referrer 헤더로 채널별 도달 집계 (사용자 식별 0)

**옵션 검토**:
- ~~(가) 별도 `/beta-signup` 폼~~ — **거부** (이메일 수집 = PII 추가, GDPR 합법근거 새로 필요, PLAN 4.6 scope 확대)
- **(나) slim.lu 직접 방문 ✓ 채택** — PII 0, 추적 0, 간결
- ~~(다) salair-plus.com 공지 페이지~~ — **거부** (T1 채널 4와 중복, 운영자 2개 사이트 관리 부담)

### T5 — 추적 0 (헌법 §8 #1)

**결정**: 모든 모집 URL = **단순 도메인** (`https://slim.lu`), **UTM 파라미터 0**

**근거**:
- 모집 도착 단계 (before first comparison) = 어트리뷰션 관심 밖
- ADR-0026 §T7 의 `?ref=` 어트리뷰션 패턴은 *제휴 클릭 단계* 전용
  - `?ref=` 콘텍스트: "제휴사 A를 선택했으니 그들의 제휴 commission 기록"
  - 모집 콘텍스트: "이 사용자는 어느 채널에서 왔는가" (관계 X, 제휴 안 함)
  - 두 수준을 섞으면 ADR-0026 추적 목적 오염

**채널별 도달 측정** (필요 시):
- PostHog `Referrer` 헤더 분석 (사용자 익명, URL param 없음)
- 운영자만 대시보드에서 집계
- 예시: referrer `facebook.com` / `reddit.com` / `salair-plus.com` / `twitter.com` 카운트

### T6 — Scope cut 옵션 E 트리거

**조건**: 4.6 베타 배포 후 **3주** 시점
- 누적 방문자 (PostHog cookieless) **≤ 50명** 이면 → **50명 목표로 마감** + 4.7 진입

**근거**:
- 솔로 + €300 cap (MONETIZATION §결정 2)
- 50명 = 피드백 신호 충분 (NPS 계산 충분 샘플 ~ 30명+)
- 3주 baseline = 정상 모집 속도 측정 기간

**일정 정합**:
- 4.6 배포 후 1주 = 4.7 (피드백) **병렬 시작**
- 3주 경계 = 4.6/4.7 상태 평가

---

## Alternatives Considered

### (a) 별도 베타 신청 폼 (`/beta-signup`)

**거부 사유**:
- **PII 추가 발생**: 이메일 필드 + (선택) 이름 → 새로운 processing activity
- **GDPR 합법근거**: Art. 6(1) 새 선택지 필요 (현재는 비교 요청 만 contract)
- **PLAN scope 확대**: 운영자 페이지 구현 + legal 검토 추가
- **추적 유혹**: "어느 사용자가 베타 등록했는가" → `?utm_source=` 유혹 → 헌법 §8 위반 경로

### (b) UTM 파라미터 (`?utm_source=korean-society&utm_medium=...`)

**거부 사유**:
- **ADR-0026 §T7 컨텍스트 오염**: 어트리뷰션 추적(클릭 단계)과 도착 추적(모집 단계) 혼재
- **사용자 식별 우려**: 운영자가 "이 UTM 클릭 → 이 제휴 클릭" 매칭 유혹
- **대안**: PostHog Referrer 헤더로 충분 (비식별)

### (c) 100명 강제 진행

**거부 사유**:
- **MONETIZATION §결정 2 (€300 cap)** 위반: 채널 다변화/PR 인력/모니터링 비용 ↑
- **ADR-0003 §scope cut 옵션 E** 권고: 50명으로 축소 가능

### (d) 채널 1개 단독 (예: Korean Society 만)

**거부 사유**:
- **도달 다양성 부족**: 한 커뮤니티만 → 지역/나이/기술 수준 bias
- **피드백 신호 약함**: 단일 채널 → 시스템 평가 불충분

---

## Consequences

### 얻는 것
- **투명성 강제** — 과장 금지 + 2개 공급사 한계 공개 → 사용자 신뢰 (장기 시각)
- **PII 0** — 베타 신청 폼 없음 → GDPR 복잡도 최소 (헌법 §8 #1)
- **추적 0** — UTM 금지 + PostHog Referrer만 → 운영자 행동 제약 (정책 강제)
- **정책 자유도** — architect 잠금 토큰 (T2) 4개만 지키면 운영자가 카피 수정/재배포 자유 (빠른 A/B test 가능)
- **비용 이점** — scope cut E로 50명 마감 시 1개월 추가 비용 회피 (€300 cap 유지)

### 잃는 것 / 부채
- **채널별 도달 정밀도 약함** — PostHog Referrer만으로 cross-channel 정확도 ±20% (UTM 대비)
  - **트레이드오프 정합성**: 베타 단계 *의도적* — 비용 vs 신호 우선순위 명시
  - 페이즈 4 이후 고도 분석 필요 시 별도 ADR (ADR-0031 가능)
- **시간 압박** — 3주 baseline이 짧음 → scope cut E 발동 시 마감 급작스러움
  - **완화책**: 1주차부터 4.7 (피드백) 병렬로 인사이트 수집

---

## Verification

### Checklist (배포 전)

#### 카피 4개 정합성 (scribe 책임, 배포 전 운영자 final check)

- [ ] 카피 4개 모두 T2 잠금 토큰 4개 포함 확인
  1. "BE 75% 2개 공급사 (Proximus + Telenet)" + "Orange BE/Voo 제외"
  2. "솔로 신생 사이트"
  3. "베타 = 비공개 사전 운영, 데이터 수집"
  4. "무료, 광고 0, 어트리뷰션 100% 공개"
- [ ] 카피 4개 전체에서 T3 과장 토큰 0건 (grep 또는 manual)
- [ ] 모집 URL = `https://slim.lu` (UTM 파라미터 0)
- [ ] 베타 신청 폼 0 (code search `/beta-signup` 또는 `/beta` 라우트 없음 확인)
- [ ] 피드백 채널 3개 명시 (이메일 + Korean Society 댓글 + GitHub Issues)
- [ ] 각 채널별 길이/톤 가이드 준수

#### D.3 선행 작업 완료 (운영자 GATE-K, 4.6 배포 전 blockers)

- [ ] D.3.a: Vercel app 설치 (또는 이미 설치됨)
- [ ] D.3.c: Vercel env vars 3개 등록 (`EXPECTED_DB_ENDPOINTS` 외)
- [ ] D.3.d: slim.lu 도메인 SSL + 리다이렉트 (운영자 DNS 확인)

#### 운영 추적 (배포 후, 운영자 responsibility)

- [ ] 4개 채널 모두 배포 완료 (link live 확인)
- [ ] PostHog cookieless 방문자 수 모니터링 활성
- [ ] 1주차 피드백 채널 모니터링 (이메일/댓글/GitHub) 시작 → 4.7 트리거
- [ ] 3주차 누적 방문자 집계 → scope cut E 평가 (≤50명이면 마감)

---

## References

- **헌법 P3 (투명성)** — "사용자에게는 결론 → 근거 → 원본 순으로 노출"
- **헌법 §8 #1** — "사용자 데이터를 외부로 보내지 않는다"
- **헌법 §8 #2** — "공급사가 보낸 가격을 가공하지 않는다"
- **헌법 §8 #3** — "다크 패턴 금지" (fake urgency, pre-checked, confirmshaming)
- **ADR-0003** — "PLAN 리얼리즘 패스" (scope cut 옵션 5개 + €300 cap 근거)
- **ADR-0004** — "MONETIZATION 솔로 사이드" (€300/월 인프라 cap)
- **ADR-0009** — "Fetcher 2개 공급사 (Proximus + Telenet)" (Orange BE 페이즈 5 이연 근거)
- **ADR-0020** — "ARBITORIA 인벤토리 + D.3 GATE-K blockers"
- **ADR-0026 §T7** — "`?ref=` 어트리뷰션 패턴" (모집 vs 클릭 콘텍스트 분리)
- **PLAN §4.6** — "베타 모집 100명 (또는 50명 scope cut E)"
- **PLAN §D.3** — "GATE-K blockers" (D.3.a/c/d 선행 작업)

---

## ADR 신설 사유

**대안 검토**: ADR-0009 (fetcher 2개 공급사) amendment vs **신설** (ADR-0029)

- **ADR-0009**: *기술 범위* — fetcher 갯수 (3→2), 스크래핑 위험, confidence 휴리스틱
- **ADR-0029** (신설): *마케팅/운영 정책* — 모집 채널, 정직성 토큰, 추적 정책, scope cut
  - 도메인 분리 명시 (ADR-0009 cross-ref 유지)
  - 본 ADR이 위 5개 결정(채널+정직+추적+신청+scope cut) *모두* 1 ADR로 잠금

**정당성**: 운영자 의도적 결정 (2026-05-13 architect 권고 + 운영자 수용)

