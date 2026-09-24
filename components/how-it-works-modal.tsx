"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    title: "เลือกอุปกรณ์",
    description: "เลือกประเภท รุ่น และข้อมูลของอุปกรณ์",
  },
  {
    title: "ระบุสภาพ",
    description: "ตอบคำถามเกี่ยวกับสภาพและการใช้งาน",
  },
  {
    title: "ดูราคาประเมิน",
    description: "รับราคาประเมินเบื้องต้นก่อนตัดสินใจดำเนินการต่อ",
  },
];

const focusableSelector =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type HowItWorksModalProps = {
  triggerLabel?: string;
  triggerClassName?: string;
};

export function HowItWorksModal({
  triggerLabel = "วิธีใช้",
  triggerClassName = "text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
}: HowItWorksModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector);

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeydown);

    const focusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
    focusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeydown);
      trigger?.focus();
    };
  }, [isOpen]);

  const modalContent = isOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(9,16,15,0.56)] px-4 py-6 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            id="how-it-works-modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
            className="relative z-[1001] w-full max-w-[44rem] max-h-[calc(100vh-48px)] overflow-auto rounded-[var(--radius-feature)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-surface)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 py-5 sm:px-7 sm:py-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="how-it-works-title"
                    className="text-[clamp(1.8rem,3vw,2.5rem)] font-semibold tracking-[-0.08em] text-[var(--color-foreground)]"
                  >
                    วิธีใช้ Atlas
                  </h2>
                  <p className="mt-2 max-w-[34rem] text-sm leading-6 text-[var(--color-muted-foreground)] sm:text-[15px]">
                    ประเมินราคาเบื้องต้นได้ใน 3 ขั้นตอนง่ายๆ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="atlas-interactive atlas-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-white text-lg text-[var(--color-foreground)]"
                  aria-label="ปิดวิธีใช้"
                >
                  ×
                </button>
              </div>

              <div className="mt-7 grid gap-3 md:grid-cols-3">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-[var(--radius-surface)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-4 shadow-[var(--shadow-tactile-sm)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-sm font-semibold text-[var(--color-action-primary)]">
                        {index + 1}
                      </span>
                      <p className="text-base font-semibold tracking-[-0.04em] text-[var(--color-foreground)]">
                        {step.title}
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-muted-foreground)]">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="how-it-works-modal"
      >
        {triggerLabel}
      </button>

      {modalContent}
    </>
  );
}
