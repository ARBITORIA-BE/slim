'use client';

/**
 * useCompareSession — 5단계 입력 sessionStorage 훅 (ADR-0016 §T8).
 *
 * - 키: `slim:compare:[category]:state`
 * - 매 입력 즉시 저장 (debounce X — beforeunload race 회피)
 * - 페이지 새로고침 시 복원
 * - 탭 닫기 시 브라우저 자동 정리 (sessionStorage 동작)
 * - localStorage 사용 X (헌법 §8 #5)
 *
 * 학습자 메모: window 객체는 SSR에서 undefined → useEffect 안에서만 접근.
 * 첫 렌더는 default value, 마운트 후 sessionStorage 값으로 hydrate.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  SESSION_STATE_VERSION,
  sessionStateSchema,
  type SessionState,
  type TariffCategoryInput,
} from '@/types/comparison-input';

// ADR-0016 Amendment 3 (ADR-0041 Amendment 2 D9): 'bill' 단계 제거 (2026-06-06).
// household 완료 후 → preview 직진 (5단계 → 4단계 골격).
const STEPS = ['postal', 'household', 'current-provider', 'preview'] as const;
export type CompareStep = (typeof STEPS)[number];

function storageKey(category: TariffCategoryInput): string {
  return `slim:compare:${category}:state`;
}

function emptyState(category: TariffCategoryInput, step: CompareStep): SessionState {
  return {
    version: SESSION_STATE_VERSION,
    category,
    step,
    data: {},
    updatedAt: new Date().toISOString(),
  };
}

interface UseCompareSessionResult {
  state: SessionState;
  /** Partial data merge — 현재 step의 필드만 업데이트. */
  updateData: (patch: Partial<SessionState['data']>) => void;
  /** 단계 이동 (URL 변경은 별도 — 이 훅은 state만 갱신). */
  setStep: (step: CompareStep) => void;
  /** 비교 완료 또는 사용자 명시 reset 시. */
  clear: () => void;
  /** 마운트 후 sessionStorage 복원이 끝났는지 (RHF defaultValues 신뢰 시점). */
  hydrated: boolean;
}

export function useCompareSession(
  category: TariffCategoryInput,
  initialStep: CompareStep,
): UseCompareSessionResult {
  const [state, setState] = useState<SessionState>(() => emptyState(category, initialStep));
  const [hydrated, setHydrated] = useState(false);
  const initialStepRef = useRef(initialStep);

  // 마운트 후 sessionStorage 읽기 (SSR 호환)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(storageKey(category));
      if (raw) {
        const parsed = sessionStateSchema.safeParse(JSON.parse(raw));
        if (parsed.success && parsed.data.category === category) {
          setState(parsed.data);
          setHydrated(true);
          return;
        }
      }
    } catch {
      // sessionStorage 접근 거부 (Safari Private 등) — default state 유지
    }
    setState(emptyState(category, initialStepRef.current));
    setHydrated(true);
    // category 변경 시에만 재실행 — initialStep은 ref로 고정
  }, [category]);

  // 매 state 변화 시 즉시 저장 (T8 — debounce X)
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(storageKey(category), JSON.stringify(state));
    } catch {
      // quota exceeded 등 무시 — UI는 정상 동작
    }
  }, [hydrated, category, state]);

  const updateData = useCallback((patch: Partial<SessionState['data']>) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, ...patch },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setStep = useCallback((step: CompareStep) => {
    setState((prev) => ({ ...prev, step, updatedAt: new Date().toISOString() }));
  }, []);

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(storageKey(category));
      } catch {
        // 무시
      }
    }
    setState(emptyState(category, initialStepRef.current));
  }, [category]);

  return { state, updateData, setStep, clear, hydrated };
}

export const compareSteps = STEPS;
