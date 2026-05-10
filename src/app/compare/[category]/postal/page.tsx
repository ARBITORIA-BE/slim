'use client';

/**
 * /compare/[category]/postal — 단계 1 우편번호 (ADR-0016 §T3, SC-B BE 1차).
 *
 * 학습자 메모 (RHF + Zod):
 *   - useForm({ resolver: zodResolver(...) }) → onChange 마다 검증
 *   - mode: 'onChange' = 즉시 피드백 (ADR-0016 §T3 명시)
 *   - sessionStorage 복원은 useCompareSession 훅이 담당, 본 페이지는 form 값을
 *     useEffect 로 sessionStorage state 와 동기화
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
  TARIFF_CATEGORIES,
  postalCodeSchema,
  type TariffCategoryInput,
} from '@/types/comparison-input';

import { CompareLayout } from '../_components/CompareLayout';
import { useCompareSession } from '../_components/useCompareSession';

const formSchema = z.object({ postalCode: postalCodeSchema.shape.postalCode });
type FormValues = z.infer<typeof formSchema>;

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
    defaultValues: { postalCode: state.data.postalCode ?? '' },
  });

  // sessionStorage 복원 후 form 값 동기화
  useEffect(() => {
    if (hydrated && state.data.postalCode !== undefined) {
      form.reset({ postalCode: state.data.postalCode });
    }
    // hydrated 1회만 트리거 — form/state.data를 deps에 넣으면 무한 reset
  }, [hydrated]);

  // 매 입력 즉시 sessionStorage 저장 (T8)
  const watched = form.watch('postalCode');
  useEffect(() => {
    if (hydrated && watched !== state.data.postalCode) {
      updateData({ postalCode: watched });
    }
  }, [hydrated, watched, state.data.postalCode, updateData]);

  const onSubmit = (values: FormValues) => {
    updateData({ postalCode: values.postalCode });
    setStep('household');
    router.push(`/compare/${category}/household`);
  };

  return (
    <CompareLayout step="postal">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          어디 사세요?
        </h1>
        <p className="text-sm text-fg-soft">
          벨기에(BE) 우편번호 4자리를 입력해 주세요. 네덜란드(NL) / 룩셈부르크(LU)는 페이즈 3 진입 직전 추가 예정입니다.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>우편번호</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="예: 1000"
                    autoComplete="postal-code"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  벨기에 우편번호는 1000~9999 사이의 4자리 숫자입니다.
                </FormDescription>
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
