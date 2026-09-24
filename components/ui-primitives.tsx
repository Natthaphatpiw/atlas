import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

function joinClasses(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary";
};

export function Button({ className, tone = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(
        "atlas-interactive atlas-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--color-disabled-surface)] disabled:text-[var(--color-disabled-foreground)] disabled:shadow-none disabled:transform-none",
        tone === "primary"
          ? "border-[var(--color-action-primary)] bg-[var(--color-action-primary)] text-[var(--color-action-primary-foreground)]"
          : "border-[var(--color-border-strong)] bg-white text-[var(--color-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

type ChoiceCardProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  children: ReactNode;
  inputType?: "checkbox" | "radio";
  wrapperClassName?: string;
};

export function ChoiceCard({
  children,
  className,
  disabled,
  inputType = "radio",
  wrapperClassName,
  ...props
}: ChoiceCardProps) {
  return (
    <label className={joinClasses("group block cursor-pointer", disabled && "cursor-not-allowed", wrapperClassName)}>
      <input type={inputType} disabled={disabled} className="peer sr-only" {...props} />
      <span
        className={joinClasses(
          "atlas-interactive block min-h-11 rounded-[var(--radius-surface)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-[var(--color-foreground)] peer-checked:border-[var(--color-action-primary)] peer-checked:bg-[var(--color-brand-primary-soft)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-focus)] peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--color-focus-ring)] peer-disabled:border-transparent peer-disabled:bg-[var(--color-disabled-surface)] peer-disabled:text-[var(--color-disabled-foreground)] peer-disabled:shadow-none peer-disabled:transform-none",
          className,
        )}
      >
        {children}
      </span>
    </label>
  );
}
