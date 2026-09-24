"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import type { CatalogDevice } from "@/domain/device-catalog";
import type { Device, DeviceCategory } from "@/domain/types";
import { devicePhotoErrorMessage, MAX_DEVICE_PHOTOS, removeDevicePhoto, selectDevicePhotos, type DevicePhotoSelectionError } from "@/lib/device-photos";
import { continueWithDevice, readValuationSession, type StoredValuationSession } from "@/lib/valuation-session";

type SelectionStage = "category" | "brand" | "model" | "specs" | "complete";
type SpecKey = keyof Device["specs"];
type SelectedDevicePhoto = { id: string; file: File; previewUrl: string };

const categoryMeta: Record<DeviceCategory, { label: string; icon: string; description: string }> = {
  phone: { label: "โทรศัพท์มือถือ", icon: "📱", description: "มือถือและสมาร์ทโฟน" },
  tablet: { label: "แท็บเล็ต", icon: "📲", description: "แท็บเล็ตและไอแพด" },
  laptop: { label: "แล็ปท็อป", icon: "💻", description: "โน้ตบุ๊กและคอมพิวเตอร์" },
  watch: { label: "สมาร์ทวอทช์", icon: "⌚", description: "นาฬิกาอัจฉริยะ" },
  audio: { label: "อุปกรณ์เสียง", icon: "🎧", description: "หูฟังและลำโพง" },
  other: { label: "อื่น ๆ", icon: "🧩", description: "อุปกรณ์ประเภทอื่น" },
};

const specLabels: Record<string, string> = {
  storage: "ความจุ",
  color: "สี",
  network: "เครือข่าย",
  ram: "หน่วยความจำ",
  displaySize: "ขนาดหน้าจอ",
};

const analyticsService = new MockAnalyticsService();
const valuationService = new MockValuationService();

const progressSteps = ["สินค้า", "สภาพ", "ราคา", "ข้อมูลติดต่อ"];

const noSessionSubscription = () => () => undefined;
const getStoredSessionRaw = () => window.sessionStorage.getItem("atlast.valuation.session");

export default function DevicePage() {
  const hydrated = useSyncExternalStore(noSessionSubscription, () => true, () => false);
  const rawSession = useSyncExternalStore(noSessionSubscription, getStoredSessionRaw, () => null);
  const [catalog, setCatalog] = useState<CatalogDevice[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    let active = true;
    valuationService.getDeviceCatalog().then(
      (devices) => {
        if (active) setCatalog(devices);
      },
      () => {
        if (active) setCatalogError(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const savedDevice = useMemo(() => {
    if (!rawSession || !catalog) return undefined;
    try {
      const stored = JSON.parse(rawSession) as StoredValuationSession;
      return catalog.some((device) => device.id === stored.device?.id) ? stored.device : undefined;
    } catch {
      return undefined;
    }
  }, [catalog, rawSession]);
  if (!hydrated) return null;
  if (!catalog && !catalogError) {
    return (
      <AppShell title="กำลังโหลดรายการสินค้า" description="ข้อมูลตัวอย่างสำหรับทดสอบ" compactHeader>
        <p className="text-sm text-slate-500" role="status">กำลังโหลด…</p>
      </AppShell>
    );
  }
  if (catalogError || !catalog) {
    return (
      <AppShell title="ไม่สามารถโหลดรายการสินค้าได้" description="โปรดลองเปิดหน้านี้อีกครั้ง" compactHeader>
        <div />
      </AppShell>
    );
  }
  return <DeviceSelection catalog={catalog} initialDevice={savedDevice} />;
}

function DeviceSelection({ catalog, initialDevice }: { catalog: CatalogDevice[]; initialDevice?: Device }) {
  const router = useRouter();
  const continuing = useRef(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSequence = useRef(0);
  const selectedPhotosRef = useRef<SelectedDevicePhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory | "">(initialDevice?.category ?? "");
  const [selectedBrand, setSelectedBrand] = useState(initialDevice?.brand ?? "");
  const [selectedModel, setSelectedModel] = useState(initialDevice?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [specSelections, setSpecSelections] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initialDevice?.specs ?? {}).filter(([, value]) => Boolean(value))));
  const [editingStage, setEditingStage] = useState<SelectionStage | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedDevicePhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<DevicePhotoSelectionError[]>([]);

  useEffect(() => {
    selectedPhotosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => () => {
    selectedPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  const visibleDevices = useMemo(
    () => (selectedCategory ? catalog.filter((device) => device.category === selectedCategory) : []),
    [catalog, selectedCategory],
  );

  const brands = useMemo(
    () => Array.from(new Set(visibleDevices.map((device) => device.brand))).sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" })),
    [visibleDevices],
  );

  const displayedModels = useMemo(
    () =>
      visibleDevices.filter(
        (device) =>
          device.brand === selectedBrand &&
          [device.model, device.variant ?? "", String(device.releaseYear)].join(" ").toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
    [searchQuery, selectedBrand, visibleDevices],
  );

  const selectedDevice = useMemo(
    () => catalog.find((device) => device.id === selectedModel) ?? null,
    [catalog, selectedModel],
  );

  const selectedSpecs = selectedDevice
    ? (Object.entries(selectedDevice.specs).filter(([, value]) => value) as [SpecKey, string][])
    : [];

  const isSpecsComplete =
    selectedSpecs.length > 0 && selectedSpecs.every(([key, value]) =>
      selectedDevice?.specOptions?.[key]?.some((option) => option.value === specSelections[key]) ?? specSelections[key] === value,
    );

  const activeStage: SelectionStage = !selectedCategory
    ? "category"
    : !selectedBrand
      ? "brand"
      : !selectedModel || !selectedDevice
        ? "model"
        : !isSpecsComplete
          ? "specs"
          : "complete";

  const stageIsOpen = (stage: SelectionStage) => activeStage === stage || editingStage === stage;
  const isComplete = activeStage === "complete";

  const clearPhotos = () => {
    setSelectedPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
    setPhotoErrors([]);
  };

  const handleCategoryChange = (category: DeviceCategory) => {
    if (category !== selectedCategory) clearPhotos();
    setSelectedCategory(category);
    setSelectedBrand("");
    setSelectedModel("");
    setSearchQuery("");
    setSpecSelections({});
    setEditingStage(null);
  };

  const handleBrandChange = (brand: string) => {
    if (brand !== selectedBrand) clearPhotos();
    setSelectedBrand(brand);
    setSelectedModel("");
    setSpecSelections({});
    setEditingStage(null);
  };

  const handleModelChange = (model: string) => {
    if (model !== selectedModel) clearPhotos();
    setSelectedModel(model);
    setSpecSelections({});
    setEditingStage(null);
  };

  const handleSpecChange = (key: string, value: string) => {
    if (specSelections[key] !== value) clearPhotos();
    setSpecSelections((current) => ({ ...current, [key]: value }));
  };

  const handlePhotoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const result = selectDevicePhotos(selectedPhotos.length, Array.from(event.target.files ?? []));
    setPhotoErrors(result.errors);
    if (result.accepted.length > 0) {
      setSelectedPhotos((current) => [
        ...current,
        ...result.accepted.map((file) => ({
          id: `device-photo-${++photoSequence.current}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    }
    event.target.value = "";
  };

  const handlePhotoRemoval = (id: string) => {
    setSelectedPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return removeDevicePhoto(current, id);
    });
    setPhotoErrors([]);
  };

  const handleBack = () => {
    if (editingStage) {
      setEditingStage(null);
      return;
    }

    if (activeStage === "brand") {
      clearPhotos();
      setSelectedCategory("");
    } else if (activeStage === "model") {
      clearPhotos();
      setSelectedBrand("");
      setSelectedModel("");
      setSpecSelections({});
    } else if (activeStage === "specs" || activeStage === "complete") {
      clearPhotos();
      setSelectedModel("");
      setSpecSelections({});
    } else {
      router.push("/");
    }
  };

  const editStage = (stage: SelectionStage) => {
    setEditingStage(stage);
    setSearchQuery("");
  };

  const handleContinue = () => {
    if (!selectedDevice || !isSpecsComplete || continuing.current) return;
    continuing.current = true;
    const previous = readValuationSession();
    // Option lists belong to the mock catalog, not the persisted device snapshot.
    const { brandId, releaseYear, sortOrder, sources, specOptions, ...deviceSnapshot } = selectedDevice;
    void brandId;
    void releaseYear;
    void sortOrder;
    void sources;
    void specOptions;
    const stored = continueWithDevice({ ...deviceSnapshot, specs: Object.fromEntries(
      selectedSpecs.map(([key]) => [key, specSelections[key]]),
    ) });
    const context = {
      sessionId: stored.session.id,
      route: "/valuation/device",
      deviceCategory: stored.device.category,
      deviceId: stored.device.id,
      timestamp: new Date().toISOString(),
    };
    // A valuation starts when the seller commits a device to a new session.
    if (previous?.session.id !== stored.session.id) {
      analyticsService.track({ ...context, eventName: "valuation_started" });
    }
    analyticsService.track({ ...context, eventName: "device_selected" });
    router.push("/valuation/condition");
  };

  return (
    <AppShell
      title="เลือกสินค้าที่ต้องการประเมินราคา"
      description="เลือกประเภทสินค้าเพื่อเริ่มต้น"
      compactHeader
      backAction={
        <button
          type="button"
          onClick={handleBack}
          aria-label="ย้อนกลับ"
          className="rounded-full p-1 text-xl text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
        >
          ←
        </button>
      }
    >
      <div className="mx-auto max-w-[820px]">
        <div className="mb-8 flex items-center gap-2" aria-label="ความคืบหน้าการประเมินราคา">
          {progressSteps.map((step, index) => (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={[
                  "h-1.5 flex-1 rounded-full",
                  index === 0 ? "bg-[var(--color-brand-primary)]" : "bg-slate-200",
                ].join(" ")}
              />
              <span
                className={[
                  "hidden whitespace-nowrap text-xs sm:block",
                  index === 0 ? "font-semibold text-slate-900" : "text-slate-400",
                ].join(" ")}
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        <section className="space-y-3">
          {selectedCategory && !stageIsOpen("category") ? (
            <SelectionRow
              label="ประเภทสินค้า"
              value={categoryMeta[selectedCategory].label}
              onEdit={() => editStage("category")}
            />
          ) : null}

          {stageIsOpen("category") ? (
            <div className="border-b border-slate-200 pb-8">
              <StageHeading eyebrow="เริ่มต้น" title="เลือกประเภทสินค้า" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.entries(categoryMeta) as [DeviceCategory, (typeof categoryMeta)[DeviceCategory]][]).map(
                  ([category, meta]) => {
                    const isSelected = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleCategoryChange(category)}
                        aria-pressed={isSelected}
                        className={[
                          "group rounded-3xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                          isSelected
                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]"
                            : "border-slate-200 bg-white hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-surface-subtle)]",
                        ].join(" ")}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-xl" aria-hidden="true">
                              {meta.icon}
                            </span>
                            <span>
                              <span className="block font-semibold text-slate-900">{meta.label}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">{meta.description}</span>
                            </span>
                          </span>
                          {isSelected ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-sm text-white" aria-label="เลือกแล้ว">
                              ✓
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          ) : null}

          {selectedBrand && !stageIsOpen("brand") ? (
            <SelectionRow label="ยี่ห้อ" value={selectedBrand} onEdit={() => editStage("brand")} />
          ) : null}

          {stageIsOpen("brand") ? (
            <div className="border-b border-slate-200 pb-8">
              <StageHeading eyebrow="ขั้นตอนถัดไป" title="เลือกยี่ห้อ" />
              <div className="flex flex-wrap gap-2">
                {brands.length > 0 ? (
                  brands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => handleBrandChange(brand)}
                      aria-pressed={selectedBrand === brand}
                      className={[
                        "rounded-full border px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                        selectedBrand === brand
                          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] text-slate-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[var(--color-brand-primary)]",
                      ].join(" ")}
                    >
                      {brand}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">ยังไม่มีข้อมูลยี่ห้อสำหรับหมวดหมู่นี้</p>
                )}
              </div>
            </div>
          ) : null}

          {selectedModel && selectedDevice && !stageIsOpen("model") ? (
            <SelectionRow
              label="รุ่น"
              value={selectedDevice.model}
              onEdit={() => editStage("model")}
            />
          ) : null}

          {stageIsOpen("model") ? (
            <div className="border-b border-slate-200 pb-8">
              <StageHeading eyebrow="ขั้นตอนถัดไป" title="เลือกรุ่น" />
              <label className="block">
                <span className="sr-only">ค้นหารุ่น</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="ค้นหาชื่อรุ่น"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-[0_8px_24px_rgba(10,26,22,0.04)] outline-none transition focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary-glow)]"
                />
              </label>

              <p className="mt-3 text-xs text-slate-500" role="status">
                {displayedModels.length} รุ่น · ข้อมูลตัวอย่างสำหรับทดสอบ
              </p>
              {displayedModels.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center">
                  <p className="font-medium text-slate-700">ไม่พบรุ่นที่ตรงกับคำค้นหา</p>
                  <p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหา หรือเลือกยี่ห้ออื่น</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    ล้างการค้นหา
                  </button>
                </div>
              ) : (
                <div className="mt-4 max-h-[min(28rem,55dvh)] space-y-2 overflow-y-auto overscroll-contain p-1" role="region" aria-label="รุ่นที่ตรงกับคำค้นหา" tabIndex={0}>
                  {displayedModels.map((device) => (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => handleModelChange(device.id)}
                      aria-pressed={selectedModel === device.id}
                      className={[
                        "flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                        selectedModel === device.id
                          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]"
                          : "border-slate-200 bg-white hover:border-[var(--color-brand-primary)]",
                      ].join(" ")}
                    >
                      <span>
                        <span className="block font-semibold text-slate-900">{device.model}</span>
                        <span className="mt-1 block text-sm text-slate-500">
                          {device.brand} · {device.releaseYear} · {categoryMeta[device.category].label}
                          {device.variant ? ` · ${device.variant}` : ""}
                        </span>
                      </span>
                      {selectedModel === device.id ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-sm text-white" aria-label="เลือกแล้ว">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {selectedDevice && isSpecsComplete && !stageIsOpen("specs") ? (
            <SelectionRow
              label="ข้อมูลจำเป็น"
              value={formatSpecs(selectedSpecs, specSelections)}
              onEdit={() => editStage("specs")}
            />
          ) : null}

          {stageIsOpen("specs") && selectedDevice ? (
            <div className="border-b border-slate-200 pb-8">
              <StageHeading eyebrow="ขั้นตอนสุดท้าย" title="เลือกข้อมูลจำเป็น" />
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedSpecs.map(([key, value]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">{specLabels[key] ?? key}</p>
                    {(selectedDevice.specOptions?.[key] ?? [{ id: `fixed-${key}`, value, label: value }]).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSpecChange(key, option.value)}
                        aria-pressed={specSelections[key] === option.value}
                        className={[
                          "mt-3 w-full rounded-full border px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                          specSelections[key] === option.value
                            ? "border-[var(--color-brand-primary)] bg-white text-slate-900"
                            : "border-slate-200 bg-white text-slate-600 hover:border-[var(--color-brand-primary)]",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDevice && isSpecsComplete ? (
            <div className="border-b border-slate-200 py-8">
              <StageHeading eyebrow="เพิ่มเติม" title="เพิ่มรูปอุปกรณ์ (ไม่บังคับ)" />
              <p id="device-photo-help" className="max-w-2xl text-sm leading-6 text-slate-600">
                รูปช่วยให้บอกบริบทของอุปกรณ์ได้ รูปจะอยู่ในเบราว์เซอร์นี้ชั่วคราวและยังไม่ได้อัปโหลดหรือใช้ในการประเมินราคา
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700" aria-live="polite">
                  {selectedPhotos.length} / {MAX_DEVICE_PHOTOS} รูป
                </p>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={selectedPhotos.length >= MAX_DEVICE_PHOTOS}
                  aria-describedby={photoErrors.length > 0 ? "device-photo-error" : "device-photo-help"}
                  className="rounded-full border border-[var(--color-brand-primary)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-brand-primary-hover)] transition-colors hover:bg-[var(--color-brand-primary-soft)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
                >
                  เพิ่มรูป
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={handlePhotoSelection}
                  className="sr-only"
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">รองรับ JPG, PNG และ WebP สูงสุด 10 MB ต่อรูป</p>

              {photoErrors.length > 0 ? (
                <div id="device-photo-error" role="alert" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {photoErrors.map((error) => <p key={`${error.fileName}-${error.reason}`}>{devicePhotoErrorMessage(error)}</p>)}
                </div>
              ) : null}

              {selectedPhotos.length > 0 ? (
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="รูปอุปกรณ์ที่เลือก">
                  {selectedPhotos.map((photo, index) => (
                    <li key={photo.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(10,26,22,0.04)]">
                      {/* Object URLs are browser-memory previews and cannot use Next image optimization. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.previewUrl}
                        alt={`ตัวอย่างรูปอุปกรณ์ ${index + 1}: ${photo.file.name}`}
                        className="aspect-square w-full rounded-xl bg-slate-100 object-cover"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs text-slate-600" title={photo.file.name}>{photo.file.name}</p>
                        <button
                          type="button"
                          onClick={() => handlePhotoRemoval(photo.id)}
                          aria-label={`ลบรูปอุปกรณ์ ${index + 1}: ${photo.file.name}`}
                          className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                        >
                          ลบ
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        {isComplete ? (
          <div className="mt-6 pt-2">
            <button
              type="button"
              onClick={handleContinue}
              className="flex w-full items-center justify-center rounded-full bg-[var(--color-action-primary)] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,192,97,0.18)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
            >
              ดำเนินการต่อ →
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function SelectionRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-sm font-semibold text-[var(--color-brand-primary-hover)]">
          ✓
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{label}</p>
          <p className="truncate font-semibold text-slate-900">{value}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--color-brand-primary-hover)] hover:bg-[var(--color-brand-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
      >
        แก้ไข
      </button>
    </div>
  );
}

function StageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium text-[var(--color-brand-primary-hover)]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
    </div>
  );
}

function formatSpecs(specs: [SpecKey, string][], selections: Record<string, string>) {
  return specs.map(([key, value]) => selections[key] ?? value).join(" · ");
}
