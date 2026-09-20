import type { CSSProperties, ReactNode } from "react";

type PreviewTheme = {
  id: "A" | "B" | "C";
  name: string;
  description: string;
  background: string;
  surface: string;
  primaryText: string;
  secondaryText: string;
  border: string;
  accent: string;
  cardRadius: number;
  cardPadding: number;
  fontStack: string;
  shadow: string;
};

type DesignPreviewProps = {
  theme: PreviewTheme;
};

const deviceCards = [
  { label: "iPhone 13 Pro", meta: "256GB · สีทอง" },
  { label: "Samsung Galaxy S23", meta: "256GB · สีพีช" },
  { label: "iPad Air", meta: "64GB · Wi‑Fi" },
  { label: "MacBook Air", meta: "M2 · 13.6 นิ้ว" },
];

const conditionOptions = [
  "สภาพดีมาก",
  "สภาพดี",
  "ปานกลาง",
  "ต้องซ่อม",
];

const selectionSummary = [
  { label: "สินค้า", value: "iPhone 13 Pro" },
  { label: "สภาพ", value: "สภาพดีมาก" },
  { label: "ช่วงราคา", value: "฿13,500 - ฿16,200" },
];

const swatches = [
  { label: "Bg", value: "#F5F7F4" },
  { label: "Surface", value: "#FFFFFF" },
  { label: "Text", value: "#12211D" },
  { label: "Secondary", value: "#5A675E" },
  { label: "Border", value: "#D8E0DB" },
  { label: "Accent", value: "#0F766E" },
];

function StatBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] uppercase">
      {children}
    </span>
  );
}

export function DesignPreview({ theme }: DesignPreviewProps) {
  const cssVars = {
    ["--preview-bg" as string]: theme.background,
    ["--preview-surface" as string]: theme.surface,
    ["--preview-primary-text" as string]: theme.primaryText,
    ["--preview-secondary-text" as string]: theme.secondaryText,
    ["--preview-border" as string]: theme.border,
    ["--preview-accent" as string]: theme.accent,
    ["--preview-card-radius" as string]: `${theme.cardRadius}px`,
    ["--preview-card-padding" as string]: `${theme.cardPadding}px`,
    ["--preview-font-stack" as string]: theme.fontStack,
    ["--preview-shadow" as string]: theme.shadow,
  } as CSSProperties;

  return (
    <div
      style={cssVars}
      className="min-h-screen"
      data-direction={theme.id}
    >
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        <header
          className="rounded-[26px] border p-3 sm:p-4"
          style={{
            background: "var(--preview-surface)",
            borderColor: "var(--preview-border)",
            boxShadow: "var(--preview-shadow)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background: "var(--preview-accent)",
                  color: "#ffffff",
                }}
              >
                A
              </div>
              <div>
                <p className="text-xl font-bold tracking-[-0.04em]" style={{ color: "var(--preview-primary-text)" }}>
                  Atlast
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatBadge>Design {theme.id}</StatBadge>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-5">
          <section
            className="rounded-[30px] border p-4 sm:p-6 lg:p-8"
            style={{
              background: "var(--preview-surface)",
              borderColor: "var(--preview-border)",
              boxShadow: "var(--preview-shadow)",
            }}
          >
            <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.18em] uppercase"
                    style={{ background: "rgba(15,118,110,0.08)", color: "var(--preview-accent)" }}
                  >
                    ประเมินราคาซื้อขายมือถือ
                  </span>
                </div>

                <h1
                  className="max-w-xl text-3xl font-bold leading-tight tracking-[-0.06em] sm:text-4xl"
                  style={{ color: "var(--preview-primary-text)" }}
                >
                  รู้ราคาสินค้าได้ใน 2 นาที
                </h1>

                <p
                  className="mt-3 max-w-xl text-sm leading-7 sm:text-base"
                  style={{ color: "var(--preview-secondary-text)" }}
                >
                  เพียงเลือกรุ่นสินค้าและสภาพของอุปกรณ์ เพื่อดูราคาประเมินเบื้องต้นก่อนตัดสินใจขายหรือแลกเปลี่ยน
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="rounded-full px-5 py-3 text-sm font-semibold"
                    style={{
                      background: "var(--preview-accent)",
                      color: "#ffffff",
                      boxShadow: "0 12px 20px rgba(15, 118, 110, 0.18)",
                    }}
                  >
                    ประเมินราคาสินค้า
                  </button>
                  <button
                    className="rounded-full border px-5 py-3 text-sm font-semibold"
                    style={{
                      borderColor: "var(--preview-border)",
                      color: "var(--preview-primary-text)",
                      background: "transparent",
                    }}
                  >
                    ดูตัวอย่างผลลัพธ์
                  </button>
                </div>
              </div>

              <div
                className="rounded-[26px] border p-4"
                style={{
                  background: "color-mix(in srgb, var(--preview-surface) 84%, var(--preview-bg))",
                  borderColor: "var(--preview-border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                    ตัวอย่างการประเมิน
                  </p>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "rgba(15,118,110,0.1)", color: "var(--preview-accent)" }}>
                    LIVE
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl p-3" style={{ background: "var(--preview-bg)", border: `1px solid var(--preview-border)` }}>
                    <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--preview-secondary-text)" }}>
                      สินค้า
                    </p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: "var(--preview-primary-text)" }}>
                      iPhone 13 Pro
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl p-3" style={{ background: "var(--preview-bg)", border: `1px solid var(--preview-border)` }}>
                      <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--preview-secondary-text)" }}>
                        สภาพ
                      </p>
                      <p className="mt-2 font-semibold" style={{ color: "var(--preview-primary-text)" }}>
                        ดีมาก
                      </p>
                    </div>
                    <div className="rounded-2xl p-3" style={{ background: "var(--preview-bg)", border: `1px solid var(--preview-border)` }}>
                      <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--preview-secondary-text)" }}>
                        ราคา
                      </p>
                      <p className="mt-2 font-semibold" style={{ color: "var(--preview-accent)" }}>
                        ฿16,200
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="rounded-[26px] border p-4 sm:p-5"
            style={{
              background: "var(--preview-surface)",
              borderColor: "var(--preview-border)",
              boxShadow: "var(--preview-shadow)",
            }}
          >
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
              ขั้นตอน
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                "เลือกสินค้า",
                "เลือกสภาพ",
                "ระบุราคาเป้าหมาย",
                "ดูผลประเมิน",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-[20px] border p-3"
                  style={{
                    background: index === 0 ? "rgba(15,118,110,0.06)" : "var(--preview-bg)",
                    borderColor: index === 0 ? "var(--preview-accent)" : "var(--preview-border)",
                  }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: index === 0 ? "var(--preview-accent)" : "var(--preview-bg)",
                      color: index === 0 ? "#ffffff" : "var(--preview-primary-text)",
                      border: `1px solid ${index === 0 ? "var(--preview-accent)" : "var(--preview-border)"}`,
                    }}
                  >
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--preview-primary-text)" }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rounded-[26px] border p-4 sm:p-5"
            style={{
              background: "var(--preview-surface)",
              borderColor: "var(--preview-border)",
              boxShadow: "var(--preview-shadow)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                เลือกรุ่นอุปกรณ์
              </p>
              <span className="text-xs" style={{ color: "var(--preview-secondary-text)" }}>
                4 รายการ
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {deviceCards.map((device, index) => (
                <button
                  key={device.label}
                  type="button"
                  className="rounded-[22px] border p-4 text-left transition-transform"
                  style={{
                    background: index === 0 ? "rgba(15,118,110,0.04)" : "var(--preview-bg)",
                    borderColor: index === 0 ? "var(--preview-accent)" : "var(--preview-border)",
                    color: "var(--preview-primary-text)",
                  }}
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold" style={{ background: "rgba(15,118,110,0.08)", color: "var(--preview-accent)" }}>
                    {device.label.charAt(0)}
                  </div>
                  <p className="text-base font-semibold">{device.label}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--preview-secondary-text)" }}>
                    {device.meta}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div
              className="rounded-[26px] border p-4 sm:p-5"
              style={{
                background: "var(--preview-surface)",
                borderColor: "var(--preview-border)",
                boxShadow: "var(--preview-shadow)",
              }}
            >
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                ข้อมูลสินค้า
              </p>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium" style={{ color: "var(--preview-primary-text)" }}>
                    รุ่น / ประเภทอุปกรณ์
                  </span>
                  <input
                    aria-label="รุ่น / ประเภทอุปกรณ์"
                    defaultValue="iPhone 13 Pro"
                    className="w-full rounded-[18px] border px-4 py-3 text-sm outline-none"
                    style={{
                      background: "var(--preview-bg)",
                      borderColor: "var(--preview-border)",
                      color: "var(--preview-primary-text)",
                    }}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium" style={{ color: "var(--preview-primary-text)" }}>
                    ความจำ / สี / รุ่นแปลง
                  </span>
                  <input
                    aria-label="ความจำ / สี / รุ่นแปลง"
                    defaultValue="256GB · สีทอง"
                    className="w-full rounded-[18px] border px-4 py-3 text-sm outline-none"
                    style={{
                      background: "var(--preview-bg)",
                      borderColor: "var(--preview-border)",
                      color: "var(--preview-primary-text)",
                    }}
                  />
                </label>
              </div>
            </div>

            <div
              className="rounded-[26px] border p-4 sm:p-5"
              style={{
                background: "var(--preview-surface)",
                borderColor: "var(--preview-border)",
                boxShadow: "var(--preview-shadow)",
              }}
            >
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                ตัวเลือก
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: "var(--preview-accent)", color: "#ffffff" }}>
                  ประเมินราคาสินค้า
                </button>
                <button className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--preview-border)", color: "var(--preview-primary-text)" }}>
                  คำนวณใหม่
                </button>
              </div>
            </div>
          </section>

          <section
            className="rounded-[26px] border p-4 sm:p-5"
            style={{
              background: "var(--preview-surface)",
              borderColor: "var(--preview-border)",
              boxShadow: "var(--preview-shadow)",
            }}
          >
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
              เลือกสภาพสินค้า
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {conditionOptions.map((condition, index) => (
                <button
                  key={condition}
                  type="button"
                  className="rounded-[20px] border p-3 text-left"
                  style={{
                    background: index === 0 ? "rgba(15,118,110,0.06)" : "var(--preview-bg)",
                    borderColor: index === 0 ? "var(--preview-accent)" : "var(--preview-border)",
                    color: "var(--preview-primary-text)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{condition}</span>
                    <span className="rounded-full px-2 py-1 text-[10px]" style={{ background: "rgba(15,118,110,0.1)", color: "var(--preview-accent)" }}>
                      {index === 0 ? "แนะนำ" : index === 1 ? "ปกติ" : "อิสระ"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section
            className="rounded-[30px] border p-4 sm:p-5"
            style={{
              background: "var(--preview-surface)",
              borderColor: "var(--preview-border)",
              boxShadow: "var(--preview-shadow)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                ผลลัพธ์การประเมิน
              </p>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "rgba(15,118,110,0.1)", color: "var(--preview-accent)" }}>
                ตอนนี้
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] p-4 sm:p-5" style={{ background: "rgba(15,118,110,0.04)", border: `1px solid var(--preview-border)` }}>
                <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                  ราคาประเมินเบื้องต้น
                </p>
                <p className="mt-3 text-3xl font-bold tracking-[-0.06em]" style={{ color: "var(--preview-accent)" }}>
                  ฿13,500 - ฿16,200
                </p>
                <p className="mt-3 text-sm" style={{ color: "var(--preview-secondary-text)" }}>
                  ตัวเลขนี้เป็นการประมาณราคาเบื้องต้นตามรุ่นและสภาพสินค้า โดยไม่รวมค่าซ่อมบำรุงหรือเครื่องมือที่ติดตั้งเพิ่มเติม
                </p>
              </div>

              <div className="space-y-3">
                {selectionSummary.map((item) => (
                  <div key={item.label} className="rounded-[20px] border p-3" style={{ background: "var(--preview-bg)", borderColor: "var(--preview-border)" }}>
                    <p className="text-[10px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-semibold" style={{ color: "var(--preview-primary-text)" }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border p-3 text-sm" style={{ background: "var(--preview-bg)", borderColor: "var(--preview-border)" }}>
              <p className="font-medium" style={{ color: "var(--preview-primary-text)" }}>
                หมายเหตุ: ราคาประเมินเบื้องต้นนี้อาจเปลี่ยนแปลงตามสภาพจริงของอุปกรณ์ และการตรวจเช็คเพิ่มเติมในภายหลัง
              </p>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div
              className="rounded-[26px] border p-4 sm:p-5"
              style={{
                background: "var(--preview-surface)",
                borderColor: "var(--preview-border)",
                boxShadow: "var(--preview-shadow)",
              }}
            >
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                แจ้งข้อมูลติดต่อ
              </p>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium" style={{ color: "var(--preview-primary-text)" }}>
                    ชื่อผู้ติดต่อ
                  </span>
                  <input
                    aria-label="ชื่อผู้ติดต่อ"
                    defaultValue="นภัสสร"
                    className="w-full rounded-[18px] border px-4 py-3 text-sm outline-none"
                    style={{
                      background: "var(--preview-bg)",
                      borderColor: "var(--preview-border)",
                      color: "var(--preview-primary-text)",
                    }}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium" style={{ color: "var(--preview-primary-text)" }}>
                    เบอร์โทรศัพท์
                  </span>
                  <input
                    aria-label="เบอร์โทรศัพท์"
                    defaultValue="081-234-5678"
                    className="w-full rounded-[18px] border px-4 py-3 text-sm outline-none"
                    style={{
                      background: "var(--preview-bg)",
                      borderColor: "var(--preview-border)",
                      color: "var(--preview-primary-text)",
                    }}
                  />
                </label>
              </div>
            </div>

            <div
              className="rounded-[26px] border p-4 sm:p-5"
              style={{
                background: "var(--preview-surface)",
                borderColor: "var(--preview-border)",
                boxShadow: "var(--preview-shadow)",
              }}
            >
              <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                ขั้นตอนต่อไป
              </p>
              <div className="mt-4 rounded-[22px] p-4" style={{ background: "rgba(15,118,110,0.05)", border: `1px solid var(--preview-border)` }}>
                <p className="text-base font-semibold" style={{ color: "var(--preview-primary-text)" }}>
                  ติดต่อผ่าน LINE Official Account
                </p>
                <p className="mt-2 text-sm" style={{ color: "var(--preview-secondary-text)" }}>
                  เพื่อยืนยันรายละเอียดและนัดตรวจเช็คอุปกรณ์ต่อไป
                </p>
                <button className="mt-4 w-full rounded-full px-4 py-3 text-sm font-semibold" style={{ background: "var(--preview-accent)", color: "#ffffff" }}>
                  เปิด LINE เพื่อส่งต่อข้อมูล
                </button>
              </div>
            </div>
          </section>

          <section
            className="rounded-[26px] border p-4 sm:p-5"
            style={{
              background: "var(--preview-surface)",
              borderColor: "var(--preview-border)",
              boxShadow: "var(--preview-shadow)",
            }}
          >
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
              สีและตัวอักษร
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {swatches.map((swatch) => (
                  <div key={swatch.label} className="rounded-[18px] border p-2" style={{ background: "var(--preview-bg)", borderColor: "var(--preview-border)" }}>
                    <div className="h-12 rounded-[12px]" style={{ background: swatch.value }} />
                    <p className="mt-2 text-[11px] font-medium" style={{ color: "var(--preview-secondary-text)" }}>
                      {swatch.label}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--preview-primary-text)" }}>
                      {swatch.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-[20px] border p-4" style={{ background: "var(--preview-bg)", borderColor: "var(--preview-border)" }}>
                <div>
                  <p className="text-[10px] font-medium tracking-[0.18em] uppercase" style={{ color: "var(--preview-secondary-text)" }}>
                    Typography direction
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-[-0.06em]" style={{ color: "var(--preview-primary-text)", fontFamily: theme.fontStack }}>
                    Atlast
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold" style={{ color: "var(--preview-primary-text)", fontFamily: theme.fontStack }}>
                    ปกติ: ข้อความเพื่อการประเมินค่าอุปกรณ์
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: "var(--preview-secondary-text)", fontFamily: theme.fontStack }}>
                    ขายหรือแลกเปลี่ยนมือถือได้ง่ายขึ้นด้วยข้อมูลราคาเบื้องต้นที่ชัดเจนและเข้าใจง่าย
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export type { PreviewTheme };
