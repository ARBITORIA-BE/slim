'use client';

/**
 * /compare/[category]/household — 단계 2 가구 형태 (ADR-0016 §T4).
 *
 * RadioGroup 카드. 모바일 (375px) 세로 스택 / md: 이상 가로 그리드 3열.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { User, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { use, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useRouter } from '@/i18n/navigation';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import {
  HOUSEHOLD_TYPES,
  TARIFF_CATEGORIES,
  householdTypeSchema,
  type HouseholdTypeInput,
  type TariffCategoryInput,
} from '@/types/comparison-input';

import { CompareLayout } from '../_components/CompareLayout';
import { useCompareSession } from '../_components/useCompareSession';

const formSchema = z.object({ householdType: householdTypeSchema });
type FormValues = z.infer<typeof formSchema>;

interface HouseholdMeta {
  value: HouseholdTypeInput;
  label: string;
  description: string;
  icon: LucideIcon;
}

const OPTIONS: HouseholdMeta[] = [
  { value: 'single', label: '혼자', description: '1인 가구', icon: User },
  { value: 'couple', label: '커플', description: '2인 가구', icon: Users },
  {
    value: 'family_3_plus',
    label: '가족',
    description: '3인 이상 가구',
    icon: UsersRound,
  },
];

// HOUSEHOLD_TYPES enum 정합성 자가 점검
const declaredOptions = new Set<string>(OPTIONS.map((o) => o.value));
for (const v of HOUSEHOLD_TYPES) {
  if (!declaredOptions.has(v)) {
    throw new Error(`/household: HOUSEHOLD_TYPES "${v}" 누락`);
  }
}

export default function HouseholdPage({
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

  const { state, updateData, setStep, hydrated } = useCompareSession(category, 'household');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    // 빈 defaultValues — RHF는 부분 객체 허용. hydrated 후 form.reset 으로 sessionStorage 값 주입.
    defaultValues: { householdType: state.data.householdType ?? ('' as unknown as HouseholdTypeInput) },
  });

  useEffect(() => {
    if (hydrated && state.data.householdType) {
      form.reset({ householdType: state.data.householdType });
    }
    // hydrated 1회만 트리거 — form/state.data를 deps에 넣으면 무한 reset
  }, [hydrated]);

  const onSubmit = (values: FormValues) => {
    updateData({ householdType: values.householdType });
    setStep('current-provider');
    router.push(`/compare/${category}/current-provider`);
  };

  return (
    <CompareLayout step="household">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          어떻게 사세요?
        </h1>
        <p className="text-sm text-fg-soft">
          가구 형태를 선택하면 평균 사용량으로 추정합니다. 정확한 사용량은
          페이즈 3에서 청구서 OCR로 자동 입력 예정입니다.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="householdType"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid grid-cols-1 gap-3 md:grid-cols-3"
                  >
                    {OPTIONS.map(({ value, label, description, icon: Icon }) => {
                      const id = `household-${value}`;
                      const isSelected = field.value === value;
                      return (
                        <Label
                          key={value}
                          htmlFor={id}
                          className={cn(
                            'flex cursor-pointer flex-col items-start gap-2 rounded-2xl border bg-bg-warm/40 p-4 transition',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-fg/10 hover:border-fg/30',
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <Icon className="h-6 w-6 text-primary" aria-hidden />
                            <RadioGroupItem id={id} value={value} />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-base font-semibold">{label}</span>
                            <span className="text-xs text-fg-soft">{description}</span>
                          </div>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={!form.formState.isValid}>
            다음 — 현재 공급사
          </Button>
        </form>
      </Form>
    </CompareLayout>
  );
}
