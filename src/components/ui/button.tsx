import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export function Button({ className, variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-full px-6 py-3 text-sm font-medium transition',
        variant === 'primary' && 'bg-fg text-bg hover:bg-primary',
        variant === 'ghost' && 'border border-fg/20 hover:bg-bg-warm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
