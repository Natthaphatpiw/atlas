export type FlowStage = "device" | "condition" | "price" | "contact";

const stages = [
  { key: "device", label: "สินค้า" },
  { key: "condition", label: "สภาพ" },
  { key: "price", label: "ราคา" },
  { key: "contact", label: "ข้อมูลติดต่อ" },
] as const;

const activeIndex: Record<FlowStage, number> = {
  device: 0,
  condition: 1,
  price: 2,
  contact: 3,
};

export function FlowProgress({ currentStage }: { currentStage: FlowStage }) {
  const currentIndex = activeIndex[currentStage];

  return (
    <nav aria-label="ความคืบหน้าการประเมินราคา" className="w-full">
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {stages.map((stage, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          const active = complete || current;
          return (
            <li key={stage.key} aria-current={current ? "step" : undefined} className="min-w-0">
              <span className="atlas-progress-track block h-1 overflow-hidden rounded-full" aria-hidden="true">
                <span className={`atlas-progress-fill block h-full ${active ? "w-full" : "w-0"}`} />
              </span>
              <span className={`mt-1.5 block truncate text-center text-[11px] leading-4 sm:text-xs ${current ? "font-semibold text-[var(--color-foreground)]" : complete ? "text-[var(--color-action-primary)]" : "text-[var(--color-subtle-foreground)]"}`}>
                {stage.label}
              </span>
              <span className="sr-only">{complete ? "เสร็จแล้ว" : current ? "ขั้นตอนปัจจุบัน" : "ขั้นตอนถัดไป"}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
