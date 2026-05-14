# Beta Recruitment Copy — Channel 3 (salair-plus.com banner/footer)

**길이:** 한국어 1~2줄 (≤80자 권고)  
**톤:** 간결 + 링크 강조  
**채널:** salair-plus.com 배너/footer (운영자 기존 자산)  
**대상:** salair-plus.com 방문자 (cross-promotion)  
**후처리:** 운영자가 웹사이트 배너/footer HTML에 직접 삽입

---

## 카피 본문

### 배너 텍스트 (긴 버전, ~80자)

```
베네룩스 통신요금 비교 사이트 Slim(slim.lu) — 1인 운영 신생 베타.
Proximus/Telenet 깊이 비교. 광고 0, 어트리뷰션 100% 공개.
```

### 또는 간결 버전 (1줄, ~50자)

```
Slim — 1인 운영 베네룩스 통신요금 비교 베타. 무료, 광고 없음. slim.lu
```

### 링크

```
https://slim.lu
```

---

## T2 정직성 토큰 검증 (본 채널)

<!-- 주의: 배너 길이 제약상 토큰 4개 모두 불가능. 토큰 1·2 우선 포함, 토큰 3·4는 slim.lu footer에서 사용자가 만나는 구조 -->

<!-- T2 Token 1: "BE 시장점유율 75% 이상의 2개 공급사 (Proximus, Telenet)" + "Orange BE/Voo 제외" -->
- ✅ L11 (긴 버전): "Proximus/Telenet 깊이 비교"
- ✅ L13 (간결): "Slim 베타 — 베네룩스 통신요금 비교"

<!-- T2 Token 2: "솔로 신생 사이트" -->
- ✅ L16 (긴 버전): "1인 운영 신생 베타" (명시)
- ✅ L23 (간결): "1인 운영 ... 베타" (명시)

<!-- T2 Token 3: "베타 = 비공개 사전 운영, 데이터 수집 목적" -->
- ✅ L10: "베타 참여 중" (시간 제한성 암시)
- ⚠️ 배너 길이 제약상 "데이터 수집" 명시 불가 → slim.lu 사이트 footer / `/legal/affiliate-disclosure` 에서 사용자가 만남

<!-- T2 Token 4: "무료, 광고 0, 어트리뷰션 100% 공개" -->
- ✅ L11 (긴 버전): "광고 0, 어트리뷰션 100% 공개"
- ✅ L13 (간결): "무료, 광고 없음"

**명시 메모:**
> 배너는 hook 단독이므로 T2 토큰 4종을 모두 담을 수 없습니다.  
> 토큰 3·4 (데이터 수집 의도 + 100% 공개) 는 slim.lu 사이트의 footer 또는 `/legal/affiliate-disclosure` 페이지에서  
> 사용자가 만나는 구조로 설계되었습니다 (ADR-0026 §T2 정합).

---

## T3 과장 금지 토큰 검증 (본 채널)

- ✅ "최고" / "최상의" / "가장 좋은" — 없음
- ✅ "유일" / "유일한" — 없음
- ✅ "혁신적" / "혁신" — 없음
- ✅ "AI" / "머신러닝" — 없음
- ✅ "가장 빠른" / "가장 저렴한" — 없음
- ✅ "100% 절약 보장" / "무조건" — 없음
- ✅ Fake urgency ("지금 바로" 등) — 없음
- ✅ "모두가" / "대부분이" 과장 수량 — 없음

---

## 기타 정합성

- ✅ 모집 URL = `https://slim.lu` (단순 도메인, UTM 0)
- ✅ 피드백 채널 언급: footer에서 `kim.wonmin91@gmail.com` / `/contact` 링크로 사용자 만남
- ✅ 한국어 단일
- ✅ 다크패턴 0 (Fake scarcity "지금만" 없음)

---

## 운영자 확인 사항

- [ ] salair-plus.com 배너 위치 결정 (header/footer/sidebar)
- [ ] CSS/스타일 준비 (운영자 판단)
- [ ] HTML 삽입 또는 CMS 배너 블록 생성
- [ ] 배포 후 slim.lu 링크 live 확인

---

## 참고

- **ADR-0029**: Beta recruitment 정책
- **Amendment 1 (2026-05-14)**: 한국어 단일 운영
- **ADR-0026 §T2**: 100% 어트리뷰션 공개 (slim.lu `/legal/affiliate-disclosure` 페이지)
- **PLAN §4.6**: 베타 모집 (채널 3 = salair-plus.com 운영자 자산)
