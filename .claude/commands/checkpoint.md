---
description: 작업 단위 마감 — 게이트 통과 + 커밋 + PLAN 업데이트
argument-hint: [PLAN-ID 예 1.7] [한 줄 메시지]
---

작업 마감 절차를 다음 순서로 실행한다:

1. **5단 게이트 실행** (`stop-gate.sh`와 동일):
   - typecheck / lint / test / harness:plan / harness:data
   - 하나라도 실패 → 중단, 사용자에게 어느 게이트인지 보고

2. **`plan-tracker` 스킬 호출**:
   - 입력: `$ARGUMENTS`의 첫 토큰을 PLAN ID로 사용
   - 해당 항목 [x] 마킹, 합계 갱신

3. **`scribe` 에이전트 호출**:
   - CHANGELOG 항목 추가
   - 영향 받는 README 동기화

4. **커밋**:
   ```bash
   git add -A
   git commit -m "feat(plan-${ID}): ${MSG}"
   ```
   메시지 컨벤션: Conventional Commits + PLAN ID

5. **다음 항목 안내** — 한 줄로
