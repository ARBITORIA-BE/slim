'use client';

/**
 * CurrentProviderForm — 단계 3 현재 공급사 + 요금제 sub-step (ADR-0016 §T5).
 *
 * 페이즈 2 1차의 disabled 버튼을 활성화. 풀 UI:
 *   1. Provider `<Select>` (RSC 가 prefetch 한 목록) — 선택 시 sub-step 노출
 *   2. (선택 후) Tariff `<Select>` — provider 별 활성 요금제 목록
 *      또는 "이 공급사 요금제 모르겠어요" 동등 버튼
 *   3. "모르겠어요 / 스킵" 동등 버튼 — currentProviderId = null + currentTariffId = null
 *
 * provider 0건 시 부모 RSC 가 다른 안내 컴포넌트 렌더 — 본 컴포넌트는 providers
 * 가 비어있지 않다고 가정.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ActiveProvider, ActiveTariff } from '@/db/queries/providers';
import type { TariffCategoryInput } from '@/types/comparison-input';

import { useCompareSession } from '../../_components/useCompareSession';

interface CurrentProviderFormProps {
  readonly category: TariffCategoryInput;
  readonly providers: ReadonlyArray<ActiveProvider>;
  /** 전체 활성 tariff 평탄 배열 — client 에서 selectedProviderId 로 filter. */
  readonly tariffs: ReadonlyArray<ActiveTariff>;
}

export function CurrentProviderForm({
  category,
  providers,
  tariffs,
}: CurrentProviderFormProps) {
  const router = useRouter();
  const { state, updateData, setStep, hydrated } = useCompareSession(
    category,
    'current-provider',
  );

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedTariffId, setSelectedTariffId] = useState<string | null>(null);
  // tariff "모르겠어요" 별도 플래그 — provider 만 저장하고 tariff null 진행 의도.
  const [tariffUnknown, setTariffUnknown] = useState(false);

  // sessionStorage 복원 (hydrated 1회)
  useEffect(() => {
    if (!hydrated) return;
    setSelectedProviderId(state.data.currentProviderId ?? null);
    setSelectedTariffId(state.data.currentTariffId ?? null);
    // tariffUnknown 은 sessionStorage 에 없음 — 매 진입 시 false 시작.
  }, [hydrated]);

  // provider 선택 변경 시 즉시 sessionStorage 저장
  useEffect(() => {
    if (!hydrated) return;
    if (selectedProviderId !== (state.data.currentProviderId ?? null)) {
      updateData({
        currentProviderId: selectedProviderId,
        currentTariffId: null, // provider 변경 시 tariff 초기화
      });
      setSelectedTariffId(null);
      setTariffUnknown(false);
    }
  }, [hydrated, selectedProviderId, state.data.currentProviderId, updateData]);

  // tariff 선택 변경 시 즉시 저장
  useEffect(() => {
    if (!hydrated) return;
    if (selectedTariffId !== (state.data.currentTariffId ?? null)) {
      updateData({ currentTariffId: selectedTariffId });
    }
  }, [hydrated, selectedTariffId, state.data.currentTariffId, updateData]);

  const filteredTariffs = useMemo(
    () => (selectedProviderId ? tariffs.filter((t) => t.providerId === selectedProviderId) : []),
    [tariffs, selectedProviderId],
  );

  const proceedSkip = () => {
    updateData({ currentProviderId: null, currentTariffId: null });
    setStep('bill');
    router.push(`/compare/${category}/bill`);
  };

  const proceedWithSelection = () => {
    updateData({
      currentProviderId: selectedProviderId,
      currentTariffId: tariffUnknown ? null : selectedTariffId,
    });
    setStep('bill');
    router.push(`/compare/${category}/bill`);
  };

  // "다음" 버튼 활성 조건:
  // - provider 선택 + tariff 선택 (정확 비교) OR
  // - provider 선택 + tariffUnknown 명시 (provider 만 비교)
  const canProceed =
    selectedProviderId !== null && (selectedTariffId !== null || tariffUnknown);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label htmlFor="provider-select" className="text-sm font-medium text-fg">
          현재 공급사
        </label>
        <Select
          {...(selectedProviderId !== null ? { value: selectedProviderId } : {})}
          onValueChange={(v) => setSelectedProviderId(v)}
        >
          <SelectTrigger id="provider-select" aria-label="현재 공급사 선택">
            <SelectValue placeholder="공급사를 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProviderId !== null && (
        <div className="flex flex-col gap-3">
          <label htmlFor="tariff-select" className="text-sm font-medium text-fg">
            현재 요금제
          </label>
          {filteredTariffs.length > 0 ? (
            <Select
              {...(!tariffUnknown && selectedTariffId !== null
                ? { value: selectedTariffId }
                : {})}
              onValueChange={(v) => {
                setSelectedTariffId(v);
                setTariffUnknown(false);
              }}
              disabled={tariffUnknown}
            >
              <SelectTrigger id="tariff-select" aria-label="현재 요금제 선택">
                <SelectValue placeholder="요금제를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {filteredTariffs.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-fg-soft">
              이 공급사의 활성 요금제가 아직 등록되지 않았습니다 (페이즈 5에서 추가 예정).
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setTariffUnknown(true);
              setSelectedTariffId(null);
            }}
            className="self-start text-sm text-fg-soft underline underline-offset-4 hover:text-fg"
          >
            이 공급사 요금제는 모르겠어요 (공급사만 비교)
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Button type="button" onClick={proceedWithSelection} disabled={!canProceed}>
          다음 — 청구서
        </Button>
        <Button type="button" variant="ghost" onClick={proceedSkip}>
          모르겠어요 / 스킵 — 신규 가입자 케이스로 진행
        </Button>
      </div>
    </div>
  );
}
