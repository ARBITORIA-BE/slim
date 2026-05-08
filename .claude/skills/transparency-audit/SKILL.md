---
name: transparency-audit
description: 분기마다 투명성 KPI 5개를 계산하고 /transparency-report 페이지를 갱신한다. MONETIZATION.md의 윤리 KPI 섹션을 기반으로 자동 운영. cron 또는 사용자 요청시 호출.
---

# Transparency Audit — 분기 투명성 감사

## 5개 KPI

1. **편향 비율** — 제휴 공급사가 알고리즘 1위 비율 (목표: 시장 점유율 이하)
2. **수수료 공개율** — 단가까지 공개한 결과 비율 (목표: 100%)
3. **데이터 신선도** — 24h 이내 갱신 비율 (목표: ≥ 95%)
4. **GDPR 처리 시간** — 평균 (목표: < 7일)
5. **사용자 만족도** — Trustpilot 평점 (목표: ≥ 4.5)

## 실행

```bash
pnpm harness:transparency
# → public/reports/QN-YYYY.md 생성
# → 5개 중 2개 이상 미달 시 수익화 동결 알림 (Sentry + 이메일)
```

## 산출물 템플릿

```markdown
# Slim 투명성 리포트 — Q3 2026

## 한눈에

| KPI | 값 | 목표 | 상태 |
|---|---|---|---|
| 편향 비율 | 32% | < 35% | ✅ |
| 수수료 공개율 | 100% | 100% | ✅ |
| 데이터 신선도 | 96.4% | ≥ 95% | ✅ |
| GDPR 처리 | 4.2일 | < 7일 | ✅ |
| Trustpilot | 4.6 | ≥ 4.5 | ✅ |

## 메소돌로지

각 KPI의 계산 방식 ...

## 원본 데이터

이 리포트의 원본 SQL 쿼리:
- [bias-ratio.sql](https://github.com/slim/slim/blob/main/sql/transparency/bias-ratio.sql)
- ...
```

## 게시 흐름

1. `harness:transparency` 실행 → 5개 값 계산
2. 템플릿 채워서 `public/reports/Q{N}-{YYYY}.md` 생성
3. scribe 호출 → CHANGELOG에 "Q3 2026 투명성 리포트 게시" 추가
4. 사용자 발표 글(블로그·뉴스레터) 초안 작성 → Pieter 검토 후 공개
