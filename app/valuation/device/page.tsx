"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type CSSProperties } from "react";
import { MockAnalyticsService } from "@/adapters/mock/analytics";
import { MockValuationService } from "@/adapters/mock/valuation";
import { AppShell } from "@/components/app-shell";
import { FlowActions, FlowBack, FlowForward } from "@/components/flow-actions";
import type { CatalogDevice } from "@/domain/device-catalog";
import type { Device, DeviceCategory } from "@/domain/types";
import { devicePhotoErrorMessage, MAX_DEVICE_PHOTOS, removeDevicePhoto, selectDevicePhotos, type DevicePhotoSelectionError } from "@/lib/device-photos";
import { selectableDeviceSpecs, selectedDeviceSnapshot } from "@/lib/device-selection";
import { continueWithDevice, readValuationSession, type StoredValuationSession } from "@/lib/valuation-session";

type SelectionStage = "category" | "brand" | "model" | "specs" | "complete";
type SpecKey = keyof Device["specs"];
type SelectedDevicePhoto = { id: string; file: File; previewUrl: string };

const categoryMeta: Record<DeviceCategory, { label: string; description: string }> = {
  phone: { label: "โทรศัพท์มือถือ", description: "มือถือและสมาร์ทโฟน" },
  tablet: { label: "แท็บเล็ต", description: "แท็บเล็ตและไอแพด" },
  laptop: { label: "แล็ปท็อป", description: "โน้ตบุ๊กและคอมพิวเตอร์" },
  watch: { label: "สมาร์ทวอทช์", description: "นาฬิกาอัจฉริยะ" },
  audio: { label: "อุปกรณ์เสียง", description: "หูฟังและลำโพง" },
  other: { label: "อื่น ๆ", description: "อุปกรณ์ประเภทอื่น" },
};

const specLabels: Record<string, string> = {
  storage: "ความจุ",
  color: "สี",
  ram: "หน่วยความจำ",
  displaySize: "ขนาดหน้าจอ",
};

const analyticsService = new MockAnalyticsService();
const valuationService = new MockValuationService();

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
      <AppShell title="กำลังโหลดรายการสินค้า" description="ข้อมูลตัวอย่างสำหรับทดสอบ" compactHeader contentSize="financial" flowStage="device" refined showHeaderBack={false}>
        <p className="text-sm text-slate-500" role="status">กำลังโหลด…</p>
      </AppShell>
    );
  }
  if (catalogError || !catalog) {
    return (
      <AppShell title="ไม่สามารถโหลดรายการสินค้าได้" description="โปรดลองเปิดหน้านี้อีกครั้ง" compactHeader contentSize="financial" flowStage="device" refined showHeaderBack={false}>
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

  // Connectivity remains a catalog/default snapshot value, but is never a seller selection.
  const selectedSpecs = selectedDevice ? selectableDeviceSpecs(selectedDevice) as [SpecKey, string][] : [];

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
    const stored = continueWithDevice(selectedDeviceSnapshot(deviceSnapshot, Object.fromEntries(selectedSpecs.map(([key]) => [key, specSelections[key]]))));
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
      description="เริ่มจากประเภทและรุ่น แล้วระบุข้อมูลจำเป็นของอุปกรณ์"
      compactHeader
      contentSize="financial"
      flowStage="device"
      refined
      showHeaderBack={false}
    >
      <div className="mx-auto max-w-[var(--layout-financial)]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:items-start lg:gap-6">
        <section className="min-w-0 space-y-4">
          {selectedCategory && !stageIsOpen("category") ? (
            <SelectionRow
              label="ประเภทสินค้า"
              value={categoryMeta[selectedCategory].label}
              onEdit={() => editStage("category")}
            />
          ) : null}

          {stageIsOpen("category") ? (
            <div className="atlas-reveal atlas-bento-surface p-4 sm:p-6">
              <StageHeading eyebrow="เริ่มต้น" title="เลือกประเภทสินค้า" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.entries(categoryMeta) as [DeviceCategory, (typeof categoryMeta)[DeviceCategory]][]).map(
                  ([category, meta], index) => {
                    const isSelected = selectedCategory === category;
                    return (
                      <div key={category} className="atlas-choice-enter" style={{ "--atlas-choice-index": Math.min(index, 6) } as CSSProperties}>
                        <button
                          type="button"
                          onClick={() => handleCategoryChange(category)}
                          aria-pressed={isSelected}
                          className={[
                            "atlas-focus atlas-interactive min-h-32 rounded-[var(--radius-surface)] border p-4 text-left",
                            isSelected
                              ? "border-[var(--color-action-primary)] bg-[var(--color-brand-primary-soft)]"
                              : "border-[var(--color-border-soft)] bg-white hover:border-[var(--color-action-primary)] hover:bg-[var(--color-surface-subtle)]",
                          ].join(" ")}
                        >
                          <span className="flex h-full flex-col justify-between gap-5">
                            <span>
                              <span className="block text-xs font-semibold text-[var(--color-action-primary)]">ประเภทอุปกรณ์</span>
                              <span className="mt-2 block text-base font-semibold text-[var(--color-foreground)]">{meta.label}</span>
                              <span className="mt-1 block text-sm leading-5 text-[var(--color-muted-foreground)]">{meta.description}</span>
                            </span>
                          </span>
                        </button>
                      </div>
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
            <div className="atlas-reveal atlas-bento-surface p-4 sm:p-6">
              <StageHeading eyebrow="ขั้นตอนถัดไป" title="เลือกยี่ห้อ" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {brands.length > 0 ? (
                  brands.map((brand, index) => (
                    <div key={brand} className="atlas-choice-enter" style={{ "--atlas-choice-index": Math.min(index, 6) } as CSSProperties}>
                      <button
                        type="button"
                        onClick={() => handleBrandChange(brand)}
                        aria-pressed={selectedBrand === brand}
                        className={[
                          "atlas-focus atlas-interactive min-h-16 rounded-[var(--radius-surface)] border px-4 py-3 text-center text-sm font-semibold",
                          selectedBrand === brand
                            ? "border-[var(--color-action-primary)] bg-[var(--color-brand-primary-soft)] text-[var(--color-foreground)]"
                            : "border-[var(--color-border-soft)] bg-white text-[var(--color-foreground)] hover:border-[var(--color-action-primary)]",
                        ].join(" ")}
                      >
                        {brand}
                      </button>
                    </div>
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
            <div className="atlas-reveal atlas-bento-surface p-4 sm:p-6">
              <StageHeading eyebrow="ขั้นตอนถัดไป" title="เลือกรุ่น" />
              <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block min-w-0 flex-1">
                <span className="sr-only">ค้นหารุ่น</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="ค้นหาชื่อรุ่น"
                  className="atlas-focus w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-base text-[var(--color-foreground)] shadow-[var(--shadow-tactile-sm)] outline-none"
                />
              </label>
              <p className="text-xs font-medium text-[var(--color-muted-foreground)]" role="status">
                {displayedModels.length} รุ่น · ข้อมูลตัวอย่างสำหรับทดสอบ
              </p>
              </div>
              {displayedModels.length === 0 ? (
                <div className="mt-4 rounded-[var(--radius-surface)] bg-[var(--color-surface-subtle)] px-4 py-8 text-center">
                  <p className="font-medium text-slate-700">ไม่พบรุ่นที่ตรงกับคำค้นหา</p>
                  <p className="mt-1 text-sm text-slate-500">ลองเปลี่ยนคำค้นหา หรือเลือกยี่ห้ออื่น</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="atlas-focus atlas-interactive mt-4 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-foreground)]"
                  >
                    ล้างการค้นหา
                  </button>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2" role="region" aria-label="รุ่นที่ตรงกับคำค้นหา">
                  {displayedModels.map((device, index) => (
                    <div key={device.id} className="atlas-choice-enter" style={{ "--atlas-choice-index": Math.min(index, 6) } as CSSProperties}>
                      <button
                        type="button"
                        onClick={() => handleModelChange(device.id)}
                        aria-pressed={selectedModel === device.id}
                        className={[
                          "atlas-focus atlas-interactive flex min-h-24 items-center justify-between rounded-[var(--radius-surface)] border px-4 py-3 text-left",
                          selectedModel === device.id
                            ? "border-[var(--color-action-primary)] bg-[var(--color-brand-primary-soft)]"
                            : "border-[var(--color-border-soft)] bg-white hover:border-[var(--color-action-primary)]",
                        ].join(" ")}
                      >
                        <span>
                          <span className="block font-semibold text-[var(--color-foreground)]">{device.model}</span>
                          <span className="mt-1 block text-sm leading-5 text-[var(--color-muted-foreground)]">
                            {device.brand} · {device.releaseYear} · {categoryMeta[device.category].label}
                            {device.variant ? ` · ${device.variant}` : ""}
                          </span>
                        </span>
                      </button>
                    </div>
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
            <div className="atlas-reveal atlas-bento-surface p-4 sm:p-6">
              <StageHeading eyebrow="ขั้นตอนสุดท้าย" title="เลือกข้อมูลจำเป็น" />
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedSpecs.map(([key, value]) => (
                  <div key={key} className="atlas-bento-muted p-4">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{specLabels[key] ?? key}</p>
                    {(selectedDevice.specOptions?.[key] ?? [{ id: `fixed-${key}`, value, label: value }]).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSpecChange(key, option.value)}
                        aria-pressed={specSelections[key] === option.value}
                        className={[
                          "atlas-focus atlas-interactive mt-3 w-full rounded-[var(--radius-control)] border px-3 py-2 text-left text-sm",
                          specSelections[key] === option.value
                            ? "border-[var(--color-action-primary)] bg-[var(--color-brand-primary-soft)] font-semibold text-[var(--color-foreground)]"
                            : "border-[var(--color-border-soft)] bg-white text-[var(--color-muted-foreground)] hover:border-[var(--color-action-primary)]",
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
            <div className="atlas-reveal atlas-bento-surface p-4 sm:p-6">
              <StageHeading eyebrow="เพิ่มเติม" title="เพิ่มรูปอุปกรณ์ (ไม่บังคับ)" />
              <p id="device-photo-help" className="max-w-2xl text-sm leading-6 text-[var(--color-muted-foreground)]">
                รูปช่วยให้บอกบริบทของอุปกรณ์ได้ รูปจะอยู่ในเบราว์เซอร์นี้ชั่วคราวและยังไม่ได้อัปโหลดหรือใช้ในการประเมินราคา
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-surface)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-4">
                <p className="text-sm font-medium text-[var(--color-foreground)]" aria-live="polite">
                  {selectedPhotos.length} / {MAX_DEVICE_PHOTOS} รูป
                </p>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={selectedPhotos.length >= MAX_DEVICE_PHOTOS}
                  aria-describedby={photoErrors.length > 0 ? "device-photo-error" : "device-photo-help"}
                  className="atlas-focus atlas-interactive rounded-[var(--radius-control)] border border-[var(--color-action-primary)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-action-primary)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
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
              <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">รองรับ JPG, PNG และ WebP สูงสุด 10 MB ต่อรูป</p>

              {photoErrors.length > 0 ? (
                <div id="device-photo-error" role="alert" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {photoErrors.map((error) => <p key={`${error.fileName}-${error.reason}`}>{devicePhotoErrorMessage(error)}</p>)}
                </div>
              ) : null}

              {selectedPhotos.length > 0 ? (
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="รูปอุปกรณ์ที่เลือก">
                  {selectedPhotos.map((photo, index) => (
                    <li key={photo.id} className="min-w-0 overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border-soft)] bg-white p-2 shadow-[var(--shadow-tactile-sm)]">
                      {/* Object URLs are browser-memory previews and cannot use Next image optimization. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.previewUrl}
                        alt={`ตัวอย่างรูปอุปกรณ์ ${index + 1}: ${photo.file.name}`}
                        className="aspect-square w-full rounded-[var(--radius-control)] bg-slate-100 object-cover"
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

        <aside className="atlas-reveal atlas-reveal-delay-1 atlas-bento-muted hidden min-h-64 p-6 lg:sticky lg:top-[calc(var(--flow-header-offset)+1.5rem)] lg:z-30 lg:block border border-[var(--color-border-soft)]" aria-label="สรุปการเลือกสินค้า">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold text-[var(--color-action-primary)]">การประเมินของคุณ</p>
            <span className="atlas-numeric text-xs font-semibold text-[var(--color-muted-foreground)]">
              {isComplete ? "พร้อมไปต่อ" : "กำลังเลือก"}
            </span>
          </div>
          {selectedDevice ? (
            <div className="mt-4">
              <p className="text-2xl font-semibold leading-8 tracking-[-0.04em] text-[var(--color-foreground)]">{selectedDevice.model}</p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{selectedBrand} · {categoryMeta[selectedDevice.category].label}</p>
              <div className="mt-5 border-t border-[var(--color-border-soft)] pt-4 text-sm text-[var(--color-muted-foreground)]">
                <p>{isSpecsComplete ? formatSpecs(selectedSpecs, specSelections) : "เลือกข้อมูลจำเป็นต่อ"}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[var(--color-muted-foreground)]">เลือกประเภท ยี่ห้อ และรุ่น เพื่อเริ่มประเมินราคา</p>
          )}
          <p className="mt-8 border-t border-[var(--color-border-soft)] pt-4 text-xs leading-5 text-[var(--color-muted-foreground)]">ข้อมูลอุปกรณ์เป็นข้อมูลตัวอย่างสำหรับการพัฒนา</p>
        </aside>
        </div>

        <div className="mt-6 border-t border-[var(--color-border-soft)] pt-5 sm:mt-8 sm:pt-6">
          <FlowActions
            back={<FlowBack onClick={handleBack}>ย้อนกลับ</FlowBack>}
            forward={<FlowForward type="button" onClick={handleContinue} disabled={!isComplete}>ดำเนินการต่อ</FlowForward>}
          />
        </div>
      </div>
    </AppShell>
  );
}

function SelectionRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="atlas-reveal flex items-center justify-between gap-3 rounded-[var(--radius-surface)] border border-[var(--color-border-soft)] bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-muted-foreground)]">{label}</p>
          <p className="truncate font-semibold text-[var(--color-foreground)]">{value}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="atlas-focus atlas-interactive shrink-0 rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium text-[var(--color-action-primary)] border border-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-soft)]"
      >
        แก้ไข
      </button>
    </div>
  );
}

function StageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium text-[var(--color-action-primary)]">{eyebrow}</p>
      <h2 className="atlas-editorial-title mt-1 text-2xl font-semibold leading-tight text-[var(--color-foreground)] sm:text-[1.75rem]">{title}</h2>
    </div>
  );
}

function formatSpecs(specs: [SpecKey, string][], selections: Record<string, string>) {
  return specs.map(([key, value]) => selections[key] ?? value).join(" · ");
}
