import type { CatalogBrand, CatalogDevice } from "@/domain/device-catalog";
import { applePhones } from "./apple";
import { googlePhones } from "./google";
import { compareCatalogDevices } from "./helpers";
import { honorPhones } from "./honor";
import { huaweiPhones } from "./huawei";
import { onePlusPhones } from "./oneplus";
import { oppoPhones } from "./oppo";
import { realmePhones } from "./realme";
import { samsungPhones } from "./samsung";
import { sonyPhones } from "./sony";
import { vivoPhones } from "./vivo";
import { xiaomiPhones } from "./xiaomi";
import { tabletCatalog } from "./tablets";
import { macCatalog } from "./macs";

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

export const deviceCatalog: CatalogDevice[] = [...phoneCatalog, ...tabletCatalog, ...macCatalog].sort(compareCatalogDevices);

export { tabletCatalog, macCatalog };

export { detailedIPhoneIds } from "./apple";
export { compareCatalogDevices } from "./helpers";
