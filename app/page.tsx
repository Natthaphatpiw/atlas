import Link from "next/link";

const steps = [
  {
    title: "เลือกอุปกรณ์",
    description: "ระบุรุ่นและรายละเอียดพื้นฐานของอุปกรณ์ที่ต้องการประเมิน",
  },
  {
    title: "ยืนยันสภาพ",
    description: "เลือกสภาพสินค้าอย่างตรงกับความเป็นจริงเพื่อให้ผลประเมินเหมาะสม",
  },
  {
    title: "ดูราคาเบื้องต้น",
    description: "รับช่วงราคาประเมินแบบง่ายและรวดเร็วก่อนตัดสินใจดำเนินการต่อ",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(7,192,97,0.10),_transparent_38%),linear-gradient(180deg,#f9fdfb_0%,#f6faf8_100%)] text-slate-900">
      <header className="border-b border-[var(--color-border-soft)] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Atlast home" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-sm font-bold text-white shadow-[0_10px_24px_rgba(7,192,97,0.26)]">
              A
            </span>
            <span className="text-xl font-bold tracking-[-0.06em] text-[var(--color-text-primary)]">
              Atlast
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--color-text-secondary)] md:flex">
            <Link href="#how-it-works" className="transition-colors hover:text-[var(--color-text-primary)]">
              วิธีใช้
            </Link>
            <Link href="#pricing-steps" className="transition-colors hover:text-[var(--color-text-primary)]">
              ขั้นตอน
            </Link>
          </nav>

          <Link
            href="/valuation/device"
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(7,192,97,0.22)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-brand-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)] min-h-[44px]"
          >
            เริ่มประเมินราคา
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
        <section className="relative">
          <div className="absolute inset-0 -z-10 rounded-[32px] bg-[radial-gradient(circle_at_20%_20%,rgba(7,192,97,0.14),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(45,141,111,0.08),transparent_30%)]" />

          <div className="overflow-hidden rounded-[32px] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[0_28px_70px_rgba(15,23,42,0.06)]">
            <div className="grid gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.06fr_0.94fr] lg:px-8 lg:py-12">
              <div className="flex flex-col justify-center text-center lg:text-left">
                <span className="inline-flex w-fit self-center rounded-full border border-[var(--color-brand-primary-soft)] bg-[var(--color-brand-primary-soft)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--color-brand-primary-strong)] uppercase lg:self-start">
                  Atlast
                </span>

                <h1 className="mt-5 text-4xl font-bold tracking-[-0.08em] text-[var(--color-text-primary)] sm:text-5xl lg:text-[4.2rem] lg:leading-[1.02]">
                  ราคาที่ตรงกับ
                  <span className="block text-[var(--color-brand-primary-strong)]">สภาพอุปกรณ์</span>
                </h1>

                <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
                  Atlast ช่วยให้คุณเห็นช่วงราคาประเมินเบื้องต้นสำหรับมือถือและอุปกรณ์ก่อนตัดสินใจขายหรือแลกเปลี่ยน
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <Link
                    href="/valuation/device"
                    className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-6 py-3 text-base font-semibold text-white shadow-[0_16px_32px_rgba(7,192,97,0.22)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-brand-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)]"
                  >
                    เริ่มประเมินราคา
                  </Link>
                </div>
              </div>

              <div className="relative flex items-center justify-center lg:justify-end">
                <div className="absolute inset-0 -z-10 rounded-[28px] bg-[radial-gradient(circle_at_center,_rgba(7,192,97,0.18),_transparent_65%)] blur-2xl" />

                <div className="w-full max-w-md rounded-[28px] border border-[var(--color-border-soft)] bg-[var(--color-surface-alt)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">
                      ตัวอย่างผลลัพธ์
                    </p>
                    <span className="rounded-full border border-[var(--color-brand-primary-soft)] bg-[var(--color-brand-primary-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-brand-primary-strong)]">
                      สดใหม่
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.03)] ring-1 ring-[var(--color-border-soft)]">
                      <p className="text-[11px] tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">สินค้า</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">iPhone 13 Pro</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.03)] ring-1 ring-[var(--color-border-soft)]">
                        <p className="text-[10px] tracking-[0.14em] text-[var(--color-text-secondary)] uppercase">สภาพ</p>
                        <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">ดีมาก</p>
                      </div>

                      <div className="rounded-[20px] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.03)] ring-1 ring-[var(--color-border-soft)]">
                        <p className="text-[10px] tracking-[0.14em] text-[var(--color-text-secondary)] uppercase">ราคา</p>
                        <p className="mt-2 text-base font-semibold text-[var(--color-brand-primary-strong)]">฿16,200</p>
                      </div>
                    </div>

                    <div className="rounded-[22px] bg-[var(--color-brand-primary-soft)] p-4 ring-1 ring-[var(--color-brand-primary-soft)]">
                      <p className="text-[10px] tracking-[0.14em] text-[var(--color-brand-primary-strong)] uppercase">ช่วงประมาณ</p>
                      <p className="mt-2 text-2xl font-bold tracking-[-0.05em] text-[var(--color-brand-primary-strong)]">฿13,500 - ฿16,200</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mt-16 sm:mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--color-text-secondary)] uppercase">
              ขั้นตอนง่ายๆ
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.07em] text-[var(--color-text-primary)] sm:text-4xl">
              ประเมินราคาแบบง่ายและชัดเจน
            </h2>
          </div>

          <div id="pricing-steps" className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[26px] border border-[var(--color-border-soft)] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.03)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-sm font-semibold text-[var(--color-brand-primary-strong)]">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 sm:mt-20">
          <div className="rounded-[30px] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 shadow-[0_16px_34px_rgba(15,23,42,0.04)] sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--color-text-secondary)] uppercase">
                  สำหรับผู้ขาย
                </p>
                <h3 className="mt-3 text-2xl font-bold tracking-[-0.06em] text-[var(--color-text-primary)] sm:text-3xl">
                  เริ่มจากรุ่นและสภาพสินค้าที่แท้จริง
                </h3>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Link
                  href="/valuation/device"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-5 py-3 text-base font-semibold text-white shadow-[0_16px_32px_rgba(7,192,97,0.22)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-brand-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-brand-primary-soft)]"
                >
                  เริ่มประเมินราคา
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
