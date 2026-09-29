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

/** Each row represents an allowed cross product for the listed dimensions. */
export type CatalogConfiguration = Partial<Record<"chip" | "ram" | "storage" | "network", string[]>>;

export interface CatalogDevice extends Device {
  /** Stable machine brand identity; `id` remains the stable model identity. */
  brandId: string;
  releaseYear: number;
  /** Explicit family ordering within a release year; lower values appear first. */
  sortOrder: number;
  specOptions: Partial<Record<DeviceSpecKey, CatalogSpecOption[]>>;
  configurations?: CatalogConfiguration[];
  sources: CatalogSource[];
}

export interface CatalogBrand {
  id: string;
  label: string;
}
