"use client";

import Link from "next/link";
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

export function HowItWorksModal() {
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
            className="relative z-[1001] w-full max-w-[820px] max-h-[calc(100vh-48px)] overflow-hidden rounded-[30px] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[0_30px_80px_rgba(18,34,27,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 py-5 sm:px-7 sm:py-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="how-it-works-title"
                    className="text-[clamp(1.8rem,3vw,2.5rem)] font-semibold tracking-[-0.08em] text-[var(--color-foreground)]"
                  >
                    วิธีใช้ Atlast
                  </h2>
                  <p className="mt-2 max-w-[34rem] text-sm leading-6 text-[var(--color-muted-foreground)] sm:text-[15px]">
                    ประเมินราคาเบื้องต้นได้ใน 3 ขั้นตอนง่ายๆ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-soft)] bg-white text-lg text-[var(--color-foreground)] transition-colors hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)]"
                  aria-label="ปิดวิธีใช้"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className="relative rounded-[24px] border border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] p-4"
                  >
                    {index < steps.length - 1 ? (
                      <div className="pointer-events-none absolute -right-2 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center text-[var(--color-brand-primary)] md:flex">
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                          <path d="M7 5L12 10L7 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-sm font-semibold text-[var(--color-brand-primary)]">
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

              <div className="mt-7 flex justify-center">
                <Link
                  href="/valuation/device"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-action-primary)] px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_var(--color-brand-primary-glow)] transition-all duration-200 hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)] sm:w-auto"
                  onClick={() => setIsOpen(false)}
                >
                  <span>เริ่มประเมินราคา</span>
                  <span className="text-xl transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </Link>
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
        className="text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="how-it-works-modal"
      >
        วิธีใช้
      </button>

      {modalContent}
    </>
  );
}
