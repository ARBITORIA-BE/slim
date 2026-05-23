'use client';

/**
 * shadcn/ui Form 패턴 (RHF + Zod 통합) — ADR-0016 §T9 옵션 A.
 *
 * 사용:
 *   const form = useForm<Schema>({ resolver: zodResolver(schema), defaultValues });
 *   <Form {...form}>
 *     <form onSubmit={form.handleSubmit(onSubmit)}>
 *       <FormField control={form.control} name="postalCode" render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>우편번호</FormLabel>
 *           <FormControl><Input {...field} /></FormControl>
 *           <FormMessage />
 *         </FormItem>
 *       )} />
 *     </form>
 *   </Form>
 *
 * 학습자 메모: FormField는 Controller wrap. FormControl은 입력 컴포넌트에 aria-*
 * 속성을 자동 주입 (Radix Slot 사용). FormMessage는 errors[name].message 자동 노출.
 */

import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => (
  <FormFieldContext.Provider value={{ name: props.name }}>
    <Controller {...props} />
  </FormFieldContext.Provider>
);

interface FormItemContextValue {
  id: string;
}

const FormItemContext = createContext<FormItemContextValue | null>(null);

export function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  // exactOptionalPropertyTypes: name은 string | string[] 만, undefined 거부.
  // fieldContext null 케이스는 아래 throw 가 방어 — fallback ''는 도달 불가.
  const formState = useFormState({ name: fieldContext?.name ?? '' });

  if (!fieldContext) throw new Error('useFormField must be used within <FormField>');
  if (!itemContext) throw new Error('useFormField must be used within <FormItem>');

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

export const FormItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = useId();
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('space-y-2', className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = 'FormItem';

export const FormLabel = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();
  return (
    <Label
      ref={ref}
      // text-accent-dark = AA contrast 통과 (text-accent 단독은 #E97462 vs #FAF7F2
      // ≈ 2.86 < 4.5). globals.css 의 --color-accent-dark 정의.
      className={cn(error && 'text-accent-dark', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = 'FormLabel';

export const FormControl = forwardRef<
  ElementRef<typeof Slot>,
  ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
});
FormControl.displayName = 'FormControl';

export const FormDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn('text-sm text-fg-soft', className)}
      {...props}
    />
  );
});
FormDescription.displayName = 'FormDescription';

/**
 * FormMessage — RHF error.message 를 렌더한다.
 *
 * ADR-0036 D1 guard: message 가 "validation." 으로 시작하면 next-intl t() 로 번역.
 * 다른 폼(비-validation 메시지 / Zod 기본 메시지)은 pass-through — blast radius 0.
 * why: schema 는 locale-free 키 토큰 ("validation.postal.be" 등)을 가지므로
 *      표시 시점에만 t() 로 매핑하여 nl/fr/en 사이트에 한국어 0 보장.
 */
export const FormMessage = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  // why: FormMessage 는 이미 'use client' — useTranslations 동기 호출 안전.
  const t = useTranslations('validation');
  const { error, formMessageId } = useFormField();

  // ADR-0036 D1: "validation." prefix keys only — map via t(); others pass-through.
  const rawMessage = error ? String(error.message ?? '') : undefined;
  const translatedMessage =
    rawMessage?.startsWith('validation.')
      ? // @builder-justification: rawMessage is guaranteed a valid validation.* key
        // because only comparison-input.ts Zod schemas emit "validation." prefixed
        // messages (ADR-0036 D1 invariant). String→key cast is safe here; runtime
        // integrity is enforced by the fixed set of keys in messages/*/validation.*.
        t(rawMessage.slice('validation.'.length) as Parameters<typeof t>[0])
      : rawMessage;
  const body = translatedMessage ?? children;

  if (!body) return null;
  return (
    <p
      ref={ref}
      id={formMessageId}
      // text-accent-dark — AA contrast pass (text-accent alone fails 4.5 ratio).
      className={cn('text-sm font-medium text-accent-dark', className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = 'FormMessage';
