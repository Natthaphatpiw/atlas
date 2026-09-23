import type { CatalogBrand, CatalogDevice } from "@/domain/device-catalog";
import { applePhones } from "./apple";
import { googlePhones } from "./google";
import { compareCatalogDevices, official } from "./helpers";
import { honorPhones } from "./honor";
import { huaweiPhones } from "./huawei";
import { onePlusPhones } from "./oneplus";
import { oppoPhones } from "./oppo";
import { realmePhones } from "./realme";
import { samsungPhones } from "./samsung";
import { sonyPhones } from "./sony";
import { vivoPhones } from "./vivo";
import { xiaomiPhones } from "./xiaomi";

export const catalogBrands: CatalogBrand[] = [
  { id: "apple", label: "Apple" },
  { id: "google", label: "Google" },
  { id: "honor", label: "HONOR" },
  { id: "huawei", label: "Huawei" },
  { id: "oneplus", label: "OnePlus" },
  { id: "oppo", label: "OPPO" },
  { id: "realme", label: "realme" },
  { id: "samsung", label: "Samsung" },
  { id: "sony", label: "Sony" },
  { id: "vivo", label: "vivo" },
  { id: "xiaomi", label: "Xiaomi" },
];

export const phoneCatalog: CatalogDevice[] = [
  ...applePhones,
  ...googlePhones,
  ...honorPhones,
  ...huaweiPhones,
  ...onePlusPhones,
  ...oppoPhones,
  ...realmePhones,
  ...samsungPhones,
  ...sonyPhones,
  ...vivoPhones,
  ...xiaomiPhones,
].sort(compareCatalogDevices);

const macBookAirM3: CatalogDevice = {
  id: "device-macbook-air-m3",
  category: "laptop",
  brandId: "apple",
  brand: "Apple",
  model: "MacBook Air",
  variant: "M3 13-inch",
  releaseYear: 2024,
  sortOrder: 10,
  specs: { ram: "16GB", displaySize: "13.6-inch", storage: "512GB" },
  specOptions: {},
  sources: [official("https://support.apple.com/en-us/118551", "global")],
  marketHints: ["Strong commercial demand", "Research-backed mock catalog"],
  createdAt: "2026-09-20T00:00:00.000Z",
};

export const deviceCatalog: CatalogDevice[] = [...phoneCatalog, macBookAirM3];

export { detailedIPhoneIds } from "./apple";
export { compareCatalogDevices } from "./helpers";
