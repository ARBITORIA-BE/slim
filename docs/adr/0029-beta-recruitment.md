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

> **D.3.c 잠금 해제 (2026-05-14)**: "신선한 가격 비교" 약속 (T2 정직성) 의 사전 조건 — fetcher
> 신선도 — 가 D.3.c 종결 (Inngest sync + Manual invoke `01KRM42BW9NNZ4A7NP386H38KJ` Completed) 로
> **0.0% → 100.0% (8/8 활성 tariff, `/admin` 헬스 카드 검증)** 도달. 4.6 베타 모집 카피 배포 가능
> 신호. ADR-0020 §History (2026-05-14 — D.3.c ✅) + §Appendix D 참조.

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

## Amendment 1 (2026-05-14): Reddit r/BENL + 한국어 단일

### 트리거

운영자 결정 (2026-05-13 이후 명시):
- **Reddit 채널 변경**: r/belgium (영어/네덜란드어, 200~400자) → **r/BENL** (한국어 BeNeLux 커뮤니티, 500~800자)
- **모든 4 채널 언어 통합**: 영어/네덜란드어/프랑스어 카피 0 → **한국어 단일**

### 근거

#### 1. ADR-0016 SC-E 정합
- **페이즈 4 베타까지 한국어 단일** 운영 (ADR-0016 §Status + PLAN §4.6 기존 정책)
- 다국어 분기 = 4.7 (피드백) + 4.8 (PR 매체) 이후 검토 (phase separation)
- Amendment 1은 *정책 일관성* 강화 (다국어 제거 X → 명시화)

#### 2. 솔로 운영 + €300 cap
- 다국어 카피 4×N개 유지보수 부담 회피
- 각 채널마다 영어/네덜란드어/프랑스어 버전 → "이미 파편화" vs "한국어 단일" 집중도 선택
- 솔로 주간 8시간 사이드 프로젝트 맥락에서 *strategic* 결정 (MONETIZATION §결정 2)

#### 3. r/belgium 자가 광고 규칙 회피
- r/belgium self-promotion 정책 엄격 (subreddit 매 월 1회 enforcement)
- r/BENL = 한국어권 베네룩스 커뮤니티 (운영자 거주 시장) → **자연어 정직성 토큰 4종이 모국어 한국어로 일치**
- 정직성 토큰이 영어 또는 네덜란드어로 표현되면 → *번역 감소*, *신뢰 오염* (모국어 아님)
- 한국어 단일 = 정직성 토큰의 **authenticity 최대화** (비원어민 마킹 0)

#### 4. 도달 한계 명시
- r/BENL 활동도 < r/belgium (의도적 "좁은 깊은 채널" 추구)
- §T6 scope cut E ("3주 ≤50명 마감") 과 정합 — *광범위 모집* 목표 아님
- PLAN §4.6 도입부 "Antwerpen / Brussels / Luxembourg 시티에서 100명" → 실질 50명 목표와 일관

### §T1 영향: 채널 2 (Reddit) 텍스트 변경

| 구분 | 기존 (r/belgium 영어) | Amendment 1 (r/BENL 한국어) |
|---|---|---|
| **채널명** | Reddit r/belgium | Reddit r/BENL |
| **대상** | Belgian tech / expat | 한국어권 베네룩스 거주자 |
| **길이** | 200~400자 (영어) | 500~800자 (한국어) |
| **톤** | Humble, self-promo rules | 정직 + 한계 명시 (채널 1과 동등) |

**새 채널 2 텍스트** (r/BENL, 500~800자):

```
베네룩스에서 통신요금을 똑똑하게 비교하는 사이트를 만들고 있습니다. **Slim** (slim.lu) 이라고 합니다.

현재는 벨기에 시장점유율 75% 이상을 차지하는 2개 공급사(Proximus, Telenet)를 깊이 있게 비교하고 있습니다. Orange BE와 Voo는 다음 단계에서 추가할 예정입니다.

**지금 하는 것:**
- 비교 결과를 5단계/5분 안에 경험 가능
- 요금제별 절약액을 명확하게 계산
- 광고 0, 어트리뷰션(수수료) 100% 공개

**주의:** 이것은 베타(비공개 사전 운영)입니다. 데이터를 수집하는 단계이며, 아직 모든 기능이 완성되지 않았습니다. 무료이며 광고는 없습니다.

**참여 방법:**  
`https://slim.lu` 에서 직접 비교를 시도해 보세요. 방문 자체가 베타 참여 신호입니다.

**피드백 채널:**
- 이메일: kim.wonmin91@gmail.com
- 이 포스트 댓글
- GitHub Issues: github.com/ARBITORIA/slim
```

### §T2 영향: 정직성 토큰 4종 (변화 0)

모든 4 채널 (Channel 1, 2, 3, 4) 에서 T2 토큰 4종 **동일하게 필수** (언어 변환만):

1. **"BE 시장 ≥75% 점유 2개 공급사 (Proximus + Telenet)" + "Orange BE/Voo 제외"**
   - 한국어: "벨기에 시장점유율 75% 이상의 2개 공급사(Proximus, Telenet)" + "Orange BE와 Voo는 다음 단계"
   
2. **"솔로 신생 사이트"**
   - 한국어: "베네룩스에서...만들고 있습니다" (현재형 + 신생 암시)
   
3. **"베타 = 비공개 사전 운영, 데이터 수집"**
   - 한국어: "이것은 베타(비공개 사전 운영)입니다. 데이터를 수집하는 단계"
   
4. **"무료, 광고 0, 어트리뷰션 100% 공개"**
   - 한국어: "무료이며 광고는 없습니다" + "광고 0, 어트리뷰션(수수료) 100% 공개"

### §T3 영향: 과장 금지 토큰 (변화 0)

8종 모두 **0건** (한국어 카피에서도):
- "최고" / "최상의" / "가장 좋은"
- "유일" / "유일한"
- "혁신적" / "혁신"
- "AI" / "머신러닝"
- "가장 빠른" / "가장 저렴한"
- "100% 절약 보장"
- "지금 바로" / "지금만"
- "대부분이" / "모두가"

**한국어 카피 검증 추가**:
- T3 토큰의 한국어 동등 표현도 회피 (예: "최고의", "유일한", "정말 빠른" 등)
- grep 대소문자 insensitive 한국어 문자열 매칭

### 잃는 것 / 취소 결정

- **r/belgium 영어권 도달 0** (의도적)
  - **트레이드오프**: 모국어 정직성 > 광범위 도달
  - 영어/네덜란드어 사용자는 r/BENL 보다는 r/belgium 구독 가능성 낮음 → 대체 채널 부족
  - **완화**: 4.7 (피드백) 에서 "영어권 사용자 요청 발생 시" 다국어 분기 early signal 수집
- **다국어 버전 기재 불가**
  - 기존 `beta-recruitment-copy.md` (영어 채널 2 + 프랑스어 미정) → **한국어 단일 통합**
  - 4.8 이후 PLAN 재평가 시 별도 `beta-recruitment-copy.en.md` / `beta-recruitment-copy.nl.md` 고려

### Verification (Amendment 1 적용 후)

- [x] r/BENL 커뮤니티 식별 + 정책 확인 (운영자) — **Amendment 2 (2026-05-15)에서 종결: r/BENL banned (Reddit about.json 직접 조회). 채널 2 제거, 옵션 C 채택.**
- [ ] 채널 2 텍스트 `docs/marketing/beta-recruitment-copy.reddit.md` 한국어 500~800자로 갱신
- [ ] T2 토큰 4종 한국어 표현 일치 확인 (각 채널별)
- [ ] T3 토큰 8종 + 한국어 동등 표현 0건 (grep 또는 manual)
- [ ] INDEX.md ADR-0029 행 "Amendment 1 (2026-05-14)" 표기

---

## ADR 신설 사유

**대안 검토**: ADR-0009 (fetcher 2개 공급사) amendment vs **신설** (ADR-0029)

- **ADR-0009**: *기술 범위* — fetcher 갯수 (3→2), 스크래핑 위험, confidence 휴리스틱
- **ADR-0029** (신설): *마케팅/운영 정책* — 모집 채널, 정직성 토큰, 추적 정책, scope cut
  - 도메인 분리 명시 (ADR-0009 cross-ref 유지)
  - 본 ADR이 위 5개 결정(채널+정직+추적+신청+scope cut) *모두* 1 ADR로 잠금

**정당성**: 운영자 의도적 결정 (2026-05-13 architect 권고 + 운영자 수용)

---

## Amendment 2 (2026-05-15): r/BENL banned — 채널 2 재결정

### 상태

**Accepted** (2026-05-15 — 운영자 직접 결정: 옵션 C 잠금 / architect 권고 수용).
ADR-0029 본체 + Amendment 1 = "운영자 직접 결정" 게이트 ADR 이므로, 본
Amendment 2 의 옵션 채택은 **운영자만** 잠근다. architect 는 권고까지만.

### 트리거

Amendment 1 §Verification 첫 항목 `[ ] r/BENL 커뮤니티 식별 + 정책 확인`
(미완료 상태로 카피 배포 직전까지 잔존) 을 2026-05-15 검증 중 결함 확인.

### 전제 정정 (사실 오류 → 정정)

- **source**: Reddit `about.json` 공개 API 직접 조회, 2026-05-15.
- **raw 결과**:

  | 서브레딧 | 상태 | 구독자 | lang |
  |---|---|---|---|
  | **r/BENL** | **banned** (`{"reason":"banned","error":404}`) | — | — |
  | r/belgium | 정상 | 396,860 | en |
  | r/Netherlands | 정상 | 493,342 | en |
  | r/BeNeLux | 정상 (소규모) | 2,088 | en |
  | r/Belgium2 | 정상 | 65,672 | en |
  | r/koreanbelgium | 존재하지 않음 | — | — |

- **정정 1 — Amendment 1 §근거 3 의 "r/BENL = 한국어권 베네룩스
  커뮤니티" 는 사실 오류.** r/BENL 은 Reddit 에서 banned 된 정지
  서브레딧 → 게시 물리적으로 불가 (0% 작동). Amendment 1 이 r/belgium →
  r/BENL 로 바꾼 핵심 논거(모국어 정직성 authenticity 최대화)는 채널 2
  에 한해 **성립 자체가 불가능**.
- **정정 2 — 한국어권 베네룩스 Reddit 커뮤니티는 존재하지 않음.**
  베네룩스 실존 서브레딧은 전부 `lang=en` (영어). r/koreanbelgium 같은
  한국어권 베네룩스 서브레딧 부재.
- **정정 3 — 운영자가 처음 제기한 모순("4채널을 한국어로 하면서 타겟이
  베네룩스 현지인이면 모순")은 단순 트레이드오프가 아니라 채널 2 한정
  *실행 불가 결함* 으로 확정.** 채널 1/3/4 (Korean Society / salair /
  Twitter) 는 한국어 단일 정합 유지 — 결함은 채널 2 에 격리됨.

### 옵션 비교 (A / B / C)

| 축 | A — 한국인 시드 명시화 | B — 현지인 확장 (영어 채널 부활) | C — 혼합/단계적 |
|---|---|---|---|
| **개요** | 베타 타겟 = "베네룩스 거주 한국인 시드" 명시. 채널 2 **제거**, 3채널(Korean Society + salair + Twitter)로 축소. 한국어 단일 유지. | 채널 2 = r/belgium 또는 r/Belgium2 (영어, 대형)로 교체 + 영어 카피 신설. | 4.6 = 한국인 시드 3채널(채널 2 제거). Reddit·현지인 도달은 4.8 PR 매체 트랙으로 명시 이관. |
| **도달** | 한국인 시드만 (TAM 좁음, 의도적). r/BENL 환상 0. | 베네룩스 현지인 영어권 (TAM 넓음). | A 와 동일 (4.6) + 4.8 에서 De Tijd/Trends 경유 NL/FR 현지인 도달. |
| **솔로 부하** | 최저 — 카피 3건 유지, 신규 0. | 최고 — 비원어민 영어 카피 신설·운영, r/belgium self-promo 정책 상시 enforcement 대응. | 낮음 — 4.6 부하 = A 와 동일. 4.8 트랙 부하는 4.8 ADR 로 이연 (지금 부담 0). |
| **€300 cap** | 영향 0 (채널 감소 = 운영비 ↓). | 압박 — 영어 카피 작성·검수·다국어 분기 조기 발생 (ADR-0029 §대안 b 거부 사유 재현). | 영향 0 (4.6). 4.8 PR 비용은 별도 ADR 게이트. |
| **정직성 토큰 영향** | T2/T3 변화 0 — 한국어 단일 + authenticity 논거 100% 보존. | T2 토큰 4종을 비원어민 영어로 표현 → Amendment 1 §근거 3 이 명시한 "번역 감소·신뢰 오염" 재발. authenticity ↓. | T2/T3 변화 0 (4.6 한국어 단일). 4.8 다국어 분기 시 별도 검증. |
| **ADR 정합** | ADR-0016 SC-E (페이즈 4 한국어 단일) + ADR-0009 (좁고 깊은 포지셔닝) + ADR-0029 §대안 d (단일채널 거부 — 3채널이라 충족) 정합. | ADR-0029 §대안 b (UTM/영어 확장) 와 Amendment 1 §근거 3 을 동시에 역행. ADR-0016 SC-E 위반. | ADR-0029 §"잃는 것" + Amendment 1 §"잃는 것"("4.7 영어권 요청 시 다국어 early signal") 이 이미 절반 예고한 방향과 정합. ADR-0016 SC-E 보존(4.6 한정). |
| **솔로+€300 적합도** | 최상 | 최하 | 상 (부하 이연으로 4.6 즉시 진입 가능) |

### architect 권고

**옵션 C 채택 권고.**

근거 (공식 문서/ADR 인용):
1. **ADR-0029 §"잃는 것" + Amendment 1 §"잃는 것"** 이 이미
   "4.7 에서 영어권 사용자 요청 발생 시 다국어 분기 early signal 수집"
   을 명문화 — C 는 이 예고된 경로의 *형식화* 이지 새 방향이 아님.
   ADR 연속성 측면에서 A 보다 정합.
2. **ADR-0016 §Status (T10 SC-E, Accepted 2026-05-10)** — "페이즈 4
   까지 한국어 단일" 운영. C 는 4.6 한정 한국어 단일을 100% 보존하면서
   현지인 도달을 4.8 로 이연 → SC-E 위반 0.
3. **ADR-0009 (fetcher 2공급사, 좁고 깊은 포지셔닝)** — 현 시점 비교
   깊이가 2공급사라 광범위 현지인 모집은 기대-실제 갭(헌장 P3 / T3)
   리스크. C 는 4.6 을 정성 시드로 한정해 이 리스크를 회피.
4. **헌장 §3 P3 (투명성은 운영자의 짐) + ADR-0004 €300 cap** — C 는
   4.6 즉시 진입을 가능케 하면서 현지인 도달 부담을 4.8 ADR 게이트로
   넘김 → 솔로 8h/주 + €300 cap 에 정합.
5. **A 와의 차이**: A 도 솔로 적합도 최상이나, "현지인 확장 경로"를
   ADR 에 명시하지 않아 추후 재논의 비용 발생. C 는 4.8 이관을 ADR
   에 못박아 미래 결정 비용을 지금 0으로 만든다. A 는 차선
   (운영자가 4.8 이관조차 원치 않으면 A 가 정답).

> B 는 비권고: ADR-0029 §대안 (b) 가 이미 거부한 방향 + Amendment 1
> §근거 3 (모국어 authenticity) 와 정면 충돌 + €300 cap 압박. 영어권
> 현지인 도달이 전략 필수가 되면 4.8 PR 트랙이 De Tijd/Trends 경유로
> 더 비용효율적 (영어 카피 신설 0).

### 채택 시 영향 (옵션 C 기준 — 운영자 승인 시)

#### 카피 4파일

| 파일 | 처리 | 사유 |
|---|---|---|
| `beta-recruitment-copy.kr.md` | **유지** | 채널 1 Korean Society, 영향 0 |
| `beta-recruitment-copy.reddit.md` | **폐기 (deprecate)** | 채널 2 제거. 파일 삭제 대신 상단에 "DEPRECATED — Amendment 2 (2026-05-15): r/BENL banned, 채널 2 제거. 4.8 PR 트랙으로 현지인 도달 이관." 헤더 1블록 추가 (이력 보존, scribe 작업) |
| `beta-recruitment-copy.salair.md` | **유지** | 채널 3, 영향 0 |
| `beta-recruitment-copy.tw.md` | **유지** | 채널 4, 영향 0 |
| 신설 | **0건** | 영어 카피 신설 없음 (옵션 B 였다면 신설 필요했음) |

#### PLAN §4.6 before/after diff (운영자 승인 시 이렇게 바뀐다 — 본 Amendment 가 직접 마킹하지 않음)

- **채널 목록 (라인 1122~1123)**
  - before: `한인 커뮤니티(Korean Society BE/NL/LU), Reddit r/BENL (Amendment 1 이후), salair-plus.com 링크 (운영자 기존 자산), 한국어 트위터/스레드`
  - after: `한인 커뮤니티(Korean Society BE/NL/LU), salair-plus.com 링크 (운영자 기존 자산), 한국어 트위터/스레드 — **3채널** (Amendment 2: r/BENL banned 확인, Reddit 채널 제거, 현지인 도달은 4.8 PR 트랙 이관)`
- **카피 4초안 (라인 1130~1135)**
  - before: `(2) Reddit r/BENL 한국어 500~800자 — humble 톤 + 자기 홍보 규칙은 운영자 직접 확인 (Amendment 1).`
  - after: `(2) ~~Reddit r/BENL~~ — **Amendment 2 (2026-05-15) 폐기: r/BENL banned (Reddit about.json 2026-05-15). 채널 2 제거, 3채널 운영.**`
  - "모집 카피 4 초안" → "모집 카피 **3** 초안" 로 수치 정정
- **4.6.c (라인 1180~1181)**
  - before: `운영자 4 채널 배포 — Korean Society / r/BENL / salair-plus.com banner / Twitter.`
  - after: `운영자 **3** 채널 배포 — Korean Society / salair-plus.com banner / Twitter. (Amendment 2: r/BENL 제거)`
  - DoD: `link live 확인 + Referrer 헤더 PostHog 활성` 은 유지 (채널 수만 4→3)
- **DoD 부모 (라인 1184~1185)**
  - before: `(4) 운영자 4.6.c 배포 + slim.lu 방문 가능`
  - after: `(4) 운영자 4.6.c **3채널** 배포 + slim.lu 방문 가능`
- **`/verify-plan` 합계**: 4.6 은 단일 sub-task 라운드(라인 1128), 채널
  수 정정은 본문 텍스트 변경이라 **체크박스 합계 변화 0**. 4.6.a/b 는
  이미 ✅ (Amendment 1 산출물) — 마킹 변경 없음. 4.6.c/d 미완료 [ ]
  유지. harness:plan itemRe 최상위 매치이므로 합계 비대상.

#### INDEX.md (운영자 승인 후에만)

- 본 Amendment 2 는 **Proposed** 이므로 INDEX.md 수정 **하지 않음**.
- 운영자 승인(Accepted 전환) 시 ADR-0029 행 status 셀에 추가:
  `**Amendment 2 (2026-05-15)** — r/BENL banned 확인 (Reddit about.json) → 채널 2 제거, 3채널 운영, 현지인 도달 4.8 PR 트랙 이관. 옵션 C 채택.`

### Amendment 1 대비 무엇이 바뀌는가

| 항목 | Amendment 1 (2026-05-14) | Amendment 2 (2026-05-15, 옵션 C) |
|---|---|---|
| 채널 수 | 4 (Reddit = r/BENL) | **3** (Reddit 제거) |
| Reddit 채널 2 | r/belgium → r/BENL 변경 | **r/BENL banned 확인 → 채널 폐기** |
| 한국어 단일 정책 | 4채널 한국어 통합 | **유지** (3채널, 변화 0) |
| 베타 타겟 | 암묵 (한국어권) | **명시: 베네룩스 거주 한국인 시드** |
| 현지인 도달 | 4.7 영어권 요청 시 early signal | **4.8 PR 매체 트랙으로 명시 이관** |
| T2/T3 토큰 | 변화 0 | 변화 0 (Amendment 1 그대로) |
| `reddit.md` 카피 | 신설 | **DEPRECATED 헤더 추가 (이력 보존)** |
| 정직성 논거 | r/BENL = 한국어 모국어 authenticity | **사실 오류로 철회 (r/BENL banned)** |

### Verification (Amendment 2 적용 후 — 운영자 승인 시)

- [x] 운영자: 본 Amendment 2 §architect 권고 검토 + 옵션 A/B/C 1개 잠금 결정
- [x] (승인 시) ADR-0029 §Amendment 2 §상태 Proposed → Accepted 전환 (운영자 + 날짜)
- [x] (승인 시) INDEX.md ADR-0029 행 Amendment 2 표기 추가 (scribe)
- [x] (승인 시) PLAN §4.6 채널 목록·4초안·4.6.c·DoD 텍스트 정정 (위 diff, builder/scribe)
- [x] (승인 시) `beta-recruitment-copy.reddit.md` 상단 DEPRECATED 헤더 추가 (scribe)
- [x] (승인 시) Amendment 1 §Verification 첫 항목 `[ ] r/BENL 커뮤니티 식별` → 본 Amendment 2 가 종결 처리 cross-ref 1줄
- [ ] harness:plan 정합 (채널 수 텍스트 변경 후 합계 불변 재확인)

### References (Amendment 2 추가)

- **Reddit `about.json` API** (2026-05-15 직접 조회) — r/BENL banned 사실 source
- **ADR-0016 §Status (T10 SC-E)** — 페이즈 4 한국어 단일 (옵션 C 정합 근거 2)
- **ADR-0009** — fetcher 2공급사, 좁고 깊은 포지셔닝 (옵션 C 정합 근거 3)
- **ADR-0029 §대안 (b)** — UTM/영어 확장 거부 (옵션 B 비권고 근거)
- **ADR-0029 Amendment 1 §근거 3 + §"잃는 것"** — 모국어 authenticity / 4.7 영어권 early signal (정정 1 + 옵션 C 정합 근거 1)
- **헌장 §3 P3 / §8 #1 (추적 0·PII 0)** — UTM 0 정책 불변, B 의 영어 확장이 cap 압박
- **ADR-0004 €300 cap** — 옵션 C 솔로 적합도 근거 4

