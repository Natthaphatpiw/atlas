import type { ButtonHTMLAttributes, ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";

type ActionProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function FlowBack({ children = "ย้อนกลับ", className = "", ...props }: Partial<ActionProps>) {
  return <button type="button" className={`atlas-interactive atlas-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--color-action-primary)] ${className}`} {...props}>
    <HugeiconsIcon icon={ArrowLeft02Icon} size={19} strokeWidth={1.8} aria-hidden="true" />{children}
  </button>;
}

export function FlowForward({ children, className = "", ...props }: ActionProps) {
  return <button className={`atlas-interactive atlas-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--color-disabled-surface)] disabled:text-[var(--color-disabled-foreground)] disabled:shadow-none disabled:transform-none ${className}`} {...props}>
    {children}<HugeiconsIcon icon={ArrowRight02Icon} size={19} strokeWidth={1.8} aria-hidden="true" />
  </button>;
}

export function FlowActions({ back, forward }: { back: ReactNode; forward: ReactNode }) {
  return <div className="grid grid-cols-[minmax(8.5rem,0.8fr)_minmax(0,1.5fr)] gap-3">{back}{forward}</div>;
}
