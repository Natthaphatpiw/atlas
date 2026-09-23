import type { Device } from "./types";

export type DeviceSpecKey = keyof Device["specs"];

export interface CatalogSpecOption {
  id: string;
  value: string;
  label: string;
}

export interface CatalogSource {
  url: string;
  region: "TH" | "global" | "regional";
}

export interface CatalogDevice extends Device {
  /** Stable machine brand identity; `id` remains the stable model identity. */
  brandId: string;
  releaseYear: number;
  /** Explicit family ordering within a release year; lower values appear first. */
  sortOrder: number;
  specOptions: Partial<Record<DeviceSpecKey, CatalogSpecOption[]>>;
  sources: CatalogSource[];
}

export interface CatalogBrand {
  id: string;
  label: string;
}
