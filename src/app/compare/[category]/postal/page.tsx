'use client';

/**
 * /compare/[category]/postal — 단계 1 우편번호 (ADR-0016 §T3 + ADR-0021 §T10).
 *
 * 페이즈 3 진입 직전 NL/LU 추가 (SC-B 발동 → ADR-0021 §T10):
 *   - 국가 Select (기본 BE) + 동적 placeholder/maxLength/autoCapitalize
 *   - NL PC6 입력 시 자동 대문자화 (UI 친화 — schema는 대문자 강제, UI에서 흡수)
 *   - NL/LU 비교 후보는 페이즈 5 fetcher 추가 전까지 0 — 결과 페이지가 정직 안내
 *
 * 학습자 메모 (RHF + Zod discriminatedUnion):
 *   - formSchema = postalCodeSchema (전체 union) — useForm<FormValues> 가
 *     country 분기 자동 추론
 *   - field.onChange 에서 NL 자동 대문자화 처리 — schema 갱신 부담 0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  POSTAL_COUNTRIES,
  TARIFF_CATEGORIES,
  postalCodeSchema,
  type PostalCountry,
  type TariffCategoryInput,
} from '@/types/comparison-input';

import { CompareLayout } from '../_components/CompareLayout';
import { useCompareSession } from '../_components/useCompareSession';

const formSchema = postalCodeSchema;
type FormValues = z.infer<typeof formSchema>;

interface CountryHint {
  label: string;
  placeholder: string;
  description: string;
  maxLength: number;
}

const COUNTRY_HINTS: Record<PostalCountry, CountryHint> = {
  BE: {
    label: '벨기에 (BE)',
    placeholder: '예: 1000',
    description: '벨기에 우편번호는 1000~9999 사이의 4자리 숫자입니다.',
    maxLength: 4,
  },
  NL: {
    label: '네덜란드 (NL)',
    placeholder: '예: 1011 또는 1011 AB',
    description:
      '네덜란드 우편번호는 4자리 숫자 (PC4) 또는 4자리+공백+대문자 2자 (PC6) 입니다. 비교 후보는 페이즈 5에서 추가됩니다.',
    maxLength: 7, // "1011 AB"
  },
  LU: {
    label: '룩셈부르크 (LU)',
    placeholder: '예: 1000',
    description:
      '룩셈부르크 우편번호는 1000~9999 사이의 4자리 숫자입니다. 비교 후보는 페이즈 5에서 추가됩니다.',
    maxLength: 4,
  },
};

export default function PostalPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const router = useRouter();
  const { category: rawCategory } = use(params);

  if (!(TARIFF_CATEGORIES as readonly string[]).includes(rawCategory)) {
    router.replace('/compare');
    return null;
  }
  const category = rawCategory as TariffCategoryInput;

  const { state, updateData, setStep, hydrated } = useCompareSession(category, 'postal');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      country: state.data.postalCountry ?? 'BE',
      postalCode: state.data.postalCode ?? '',
    } as FormValues,
  });

  // sessionStorage 복원 후 form 값 동기화 (hydrated 1회만)
  useEffect(() => {
    if (!hydrated) return;
    const country = state.data.postalCountry ?? 'BE';
    const postalCode = state.data.postalCode ?? '';
    form.reset({ country, postalCode } as FormValues);
    // form/state 를 deps 에 넣으면 무한 reset — hydrated 단발 트리거.
  }, [hydrated]);

  // 매 입력 즉시 sessionStorage 저장 (T8) — country + postalCode 둘 다 추적.
  const watchedCountry = form.watch('country');
  const watchedPostal = form.watch('postalCode');
  useEffect(() => {
    if (!hydrated) return;
    if (
      watchedCountry !== state.data.postalCountry ||
      watchedPostal !== state.data.postalCode
    ) {
      updateData({ postalCountry: watchedCountry, postalCode: watchedPostal });
    }
  }, [
    hydrated,
    watchedCountry,
    watchedPostal,
    state.data.postalCountry,
    state.data.postalCode,
    updateData,
  ]);

  // 국가 변경 시 postalCode 형식 검증을 위해 재검증 트리거.
  useEffect(() => {
    if (hydrated) form.trigger('postalCode');
    // form 은 stable, watchedCountry 만 의존.
  }, [hydrated, watchedCountry]);

  const onSubmit = (values: FormValues) => {
    updateData({ postalCountry: values.country, postalCode: values.postalCode });
    setStep('household');
    router.push(`/compare/${category}/household`);
  };

  const hint = COUNTRY_HINTS[watchedCountry];

  return (
    <CompareLayout step="postal">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          어디 사세요?
        </h1>
        <p className="text-sm text-fg-soft">
          국가를 선택한 후 우편번호를 입력하세요. 현재 벨기에(BE) 통신 비교를 지원합니다.
          네덜란드(NL) / 룩셈부르크(LU)는 페이즈 5 공급사 추가 시점까지 비교 후보가 없을 수 있습니다.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>국가</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger aria-label="국가 선택">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {POSTAL_COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {COUNTRY_HINTS[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>우편번호</FormLabel>
                <FormControl>
                  <Input
                    inputMode={watchedCountry === 'NL' ? 'text' : 'numeric'}
                    maxLength={hint.maxLength}
                    placeholder={hint.placeholder}
                    autoComplete="postal-code"
                    autoFocus
                    value={field.value ?? ''}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // NL PC6 자동 대문자화 (schema 는 대문자 강제, UI 가 흡수)
                      const next = watchedCountry === 'NL' ? raw.toUpperCase() : raw;
                      field.onChange(next);
                    }}
                  />
                </FormControl>
                <FormDescription>{hint.description}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={!form.formState.isValid}>
            다음 — 가구 형태
          </Button>
        </form>
      </Form>
    </CompareLayout>
  );
}
