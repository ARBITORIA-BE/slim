'use client';

/**
 * /compare/[category]/household — 단계 2 가구 형태 (ADR-0016 §T4).
 *
 * RadioGroup 카드. 모바일 (375px) 세로 스택 / md: 이상 가로 그리드 3열.
 *
 * i18n: useTranslations (client 컴포넌트) — 'compare.household' 네임스페이스.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { User, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { use, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslations } from 'next-intl';

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

type HouseholdOptionKey = HouseholdTypeInput;

const OPTION_ICONS: Record<HouseholdOptionKey, LucideIcon> = {
  single: User,
  couple: Users,
  family_3_plus: UsersRound,
};

// HOUSEHOLD_TYPES enum 정합성 자가 점검
const iconKeys = new Set<string>(Object.keys(OPTION_ICONS));
for (const v of HOUSEHOLD_TYPES) {
  if (!iconKeys.has(v)) {
    throw new Error(`/household: HOUSEHOLD_TYPES "${v}" 아이콘 누락`); // @i18n-allow 개발자 에러 메시지 — 사용자 미노출
  }
}

export default function HouseholdPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  // why: useTranslations 은 client 컴포넌트에서 동기 호출.
  const t = useTranslations('compare.household');

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
    // ADR-0043 §D5 (2026-06-08): 3단계 = current-provider → household → preview.
    // 구 4단계 (postal → household → current-provider → bill → preview) 시절 잠금이
    // ADR-0043 sweep 시 회귀로 전이 (2026-06-09 P0 #5 봉합). STEPS 단일 출처 정합.
    setStep('preview');
    router.push(`/compare/${category}/preview`);
  };

  return (
    <CompareLayout step="household">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {t('heading')}
        </h1>
        <p className="text-sm text-fg-soft">
          {t('supportNote')}
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
                    {HOUSEHOLD_TYPES.map((value) => {
                      const Icon = OPTION_ICONS[value];
                      // why: t() 로 label/description 조회 — 키: compare.household.options.{value}.label
                      const label = t(`options.${value}.label` as Parameters<typeof t>[0]);
                      const description = t(`options.${value}.description` as Parameters<typeof t>[0]);
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
            {t('nextButton')}
          </Button>
        </form>
      </Form>
    </CompareLayout>
  );
}
