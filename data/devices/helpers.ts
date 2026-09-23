import type { CatalogDevice, CatalogSource, CatalogSpecOption } from "@/domain/device-catalog";

const mockCreatedAt = "2026-09-20T00:00:00.000Z";

function optionId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function options(values: string[]): CatalogSpecOption[] {
  return values.map((value) => ({ id: optionId(value), value, label: value }));
}

export function official(url: string, region: CatalogSource["region"] = "TH"): CatalogSource {
  return { url, region };
}

export function phone(input: {
  id: string;
  brandId: string;
  brand: string;
  model: string;
  variant?: string;
  releaseYear: number;
  sortOrder: number;
  storage: string[];
  colors?: string[];
  defaultStorage?: string;
  defaultColor?: string;
  sources: CatalogSource[];
  regional?: boolean;
}): CatalogDevice {
  const storage = input.defaultStorage ?? input.storage[0];
  const color = input.defaultColor ?? input.colors?.[0];
  return {
    id: input.id,
    category: "phone",
    brandId: input.brandId,
    brand: input.brand,
    model: input.model,
    ...(input.variant ? { variant: input.variant } : {}),
    releaseYear: input.releaseYear,
    sortOrder: input.sortOrder,
    specs: { storage, ...(color ? { color } : {}), network: "5G" },
    specOptions: {
      storage: options(input.storage),
      ...(input.colors ? { color: options(input.colors) } : {}),
    },
    sources: input.sources,
    marketHints: ["Research-backed mock catalog", ...(input.regional ? ["Regional availability varies"] : [])],
    createdAt: mockCreatedAt,
  };
}

export function compareCatalogDevices(left: CatalogDevice, right: CatalogDevice) {
  return right.releaseYear - left.releaseYear || left.sortOrder - right.sortOrder || left.model.localeCompare(right.model, "en");
}
