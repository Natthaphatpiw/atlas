import type { CatalogDevice, CatalogSource } from "@/domain/device-catalog";
import { catalogItem, official, options } from "./helpers";

/** Manufacturer model guides and product specifications are retained per entry. */
const appleGuide = official("https://support.apple.com/en-gb/108043", "global");

function tablet(input: {
  id: string;
  brandId: string;
  brand: string;
  model: string;
  releaseYear: number;
  sortOrder?: number;
  storage: string[];
  ram?: string;
  chip?: string;
  displaySize?: string;
  network?: "Wi-Fi" | "Wi-Fi + Cellular";
  cellular?: boolean;
  stylus?: boolean;
  configurations?: CatalogDevice["configurations"];
  sources: CatalogSource[];
}): CatalogDevice {
  const network = input.network ?? "Wi-Fi";
  const item = catalogItem({
    id: input.id,
    category: "tablet",
    brandId: input.brandId,
    brand: input.brand,
    model: input.model,
    releaseYear: input.releaseYear,
    sortOrder: input.sortOrder ?? 10,
    specs: { storage: input.storage[0], ...(input.ram ? { ram: input.ram } : {}), ...(input.chip ? { chip: input.chip } : {}), ...(input.displaySize ? { displaySize: input.displaySize } : {}), network },
    storageOptions: input.storage,
    sources: input.sources,
  });
  item.specOptions.network = options(input.cellular ? ["Wi-Fi", "Wi-Fi + Cellular"] : [network]);
  if (input.configurations) {
    item.configurations = input.configurations;
    const ramValues = [...new Set(input.configurations.flatMap((configuration) => configuration.ram ?? []))];
    if (ramValues.length) item.specOptions.ram = options(ramValues);
    const chipValues = [...new Set(input.configurations.flatMap((configuration) => configuration.chip ?? []))];
    if (chipValues.length) item.specOptions.chip = options(chipValues);
  }
  if (input.stylus) item.capabilities = { stylus: true };
  return item;
}

function ipad(id: string, model: string, releaseYear: number, storage: string[], displaySize?: string): CatalogDevice {
  return tablet({ id, brandId: "apple", brand: "Apple", model, releaseYear, storage, displaySize, cellular: true, stylus: true, sources: [appleGuide] });
}

function ipadPro(id: string, model: string, year: 2024 | 2025, size: "11-inch" | "13-inch", source: string): CatalogDevice {
  const chip = year === 2025 ? "M5" : "M4";
  const lowerMemory = year === 2025 ? "12GB" : "8GB";
  const lowChip = `Apple ${chip} (9-core CPU)`;
  const highChip = `Apple ${chip} (10-core CPU)`;
  return tablet({
    id, brandId: "apple", brand: "Apple", model, releaseYear: year, displaySize: size,
    storage: ["256GB", "512GB", "1TB", "2TB"], ram: lowerMemory, chip: lowChip,
    cellular: true, stylus: true, sources: [appleGuide, official(source, "global")],
    configurations: [
      { storage: ["256GB", "512GB"], ram: [lowerMemory], chip: [lowChip] },
      { storage: ["1TB", "2TB"], ram: ["16GB"], chip: [highChip] },
    ],
  });
}

function memoryStorage(...pairs: Array<[string, string]>): NonNullable<CatalogDevice["configurations"]> {
  return pairs.map(([ram, storage]) => ({ ram: [ram], storage: [storage] }));
}

const appleTablets: CatalogDevice[] = [
  ipad("device-ipad-a16", "iPad (A16)", 2025, ["128GB", "256GB", "512GB"], "11-inch"),
  ipad("device-ipad-10th", "iPad (10th generation)", 2022, ["64GB", "256GB"], "10.9-inch"),
  ipad("device-ipad-9th", "iPad (9th generation)", 2021, ["64GB", "256GB"], "10.2-inch"),
  ipad("device-ipad-8th", "iPad (8th generation)", 2020, ["32GB", "128GB"], "10.2-inch"),
  ipad("device-ipad-mini-a17-pro", "iPad mini (A17 Pro)", 2024, ["128GB", "256GB", "512GB"], "8.3-inch"),
  ipad("device-ipad-mini-6th", "iPad mini (6th generation)", 2021, ["64GB", "256GB"], "8.3-inch"),
  ipad("device-ipad-air-m4-11", "iPad Air 11-inch (M4)", 2026, ["128GB", "256GB", "512GB", "1TB"], "11-inch"),
  ipad("device-ipad-air-m4-13", "iPad Air 13-inch (M4)", 2026, ["128GB", "256GB", "512GB", "1TB"], "13-inch"),
  ipad("device-ipad-air-m3-11", "iPad Air 11-inch (M3)", 2025, ["128GB", "256GB", "512GB", "1TB"], "11-inch"),
  ipad("device-ipad-air-m3-13", "iPad Air 13-inch (M3)", 2025, ["128GB", "256GB", "512GB", "1TB"], "13-inch"),
  ipad("device-ipad-air-m2-11", "iPad Air 11-inch (M2)", 2024, ["128GB", "256GB", "512GB", "1TB"], "11-inch"),
  ipad("device-ipad-air-m2-13", "iPad Air 13-inch (M2)", 2024, ["128GB", "256GB", "512GB", "1TB"], "13-inch"),
  ipad("device-ipad-air-5th", "iPad Air (5th generation)", 2022, ["64GB", "256GB"], "10.9-inch"),
  ipad("device-ipad-air-4th", "iPad Air (4th generation)", 2020, ["64GB", "256GB"], "10.9-inch"),
  ipadPro("device-ipad-pro-m5-11", "iPad Pro 11-inch (M5)", 2025, "11-inch", "https://support.apple.com/en-us/125406"),
  ipadPro("device-ipad-pro-m5-13", "iPad Pro 13-inch (M5)", 2025, "13-inch", "https://support.apple.com/en-us/125407"),
  ipadPro("device-ipad-pro-m4-11", "iPad Pro 11-inch (M4)", 2024, "11-inch", "https://support.apple.com/en-us/119892"),
  ipadPro("device-ipad-pro-m4-13", "iPad Pro 13-inch (M4)", 2024, "13-inch", "https://support.apple.com/en-us/119891"),
  ipad("device-ipad-pro-11-4th", "iPad Pro 11-inch (4th generation)", 2022, ["128GB", "256GB", "512GB", "1TB", "2TB"], "11-inch"),
  ipad("device-ipad-pro-12-9-6th", "iPad Pro 12.9-inch (6th generation)", 2022, ["128GB", "256GB", "512GB", "1TB", "2TB"], "12.9-inch"),
  ipad("device-ipad-pro-11-3rd", "iPad Pro 11-inch (3rd generation)", 2021, ["128GB", "256GB", "512GB", "1TB", "2TB"], "11-inch"),
  ipad("device-ipad-pro-12-9-5th", "iPad Pro 12.9-inch (5th generation)", 2021, ["128GB", "256GB", "512GB", "1TB", "2TB"], "12.9-inch"),
  ipad("device-ipad-pro-11-2nd", "iPad Pro 11-inch (2nd generation)", 2020, ["128GB", "256GB", "512GB", "1TB"], "11-inch"),
  ipad("device-ipad-pro-12-9-4th", "iPad Pro 12.9-inch (4th generation)", 2020, ["128GB", "256GB", "512GB", "1TB"], "12.9-inch"),
];

const samsungSources = {
  s11: official("https://news.samsung.com/global/meet-samsung-galaxy-tab-s11-series-packing-everything-you-expect-from-a-premium-tablet", "global"),
  s10: official("https://news.samsung.com/global/galaxy-tab-s10-series-is-samsungs-ai-ready-tablet", "global"),
  s10fe: official("https://news.samsung.com/us/galaxy-tab-s10-fe-series-intelligent-experiences-premium-versatile-design/", "global"),
  s10lite: official("https://news.samsung.com/global/galaxy-tab-s10-lite-a-value-packed-tablet-for-everyday-needs", "global"),
  s9: official("https://news.samsung.com/global/samsung-galaxy-tab-s9-sets-the-new-standard-to-bring-galaxys-premium-experience-to-a-tablet", "global"),
  s9fe: official("https://news.samsung.com/global/samsung-galaxy-s23-fe-galaxy-tab-s9-fe-and-galaxy-buds-fe-bring-standout-features-to-even-more-users", "global"),
  s8: official("https://news.samsung.com/global/breaking-the-rules-with-galaxy-tab-s8-series-the-biggest-boldest-most-versatile-galaxy-tablet-ever", "global"),
  s7: official("https://news.samsung.com/global/meet-galaxy-tab-s7-and-s7-plus-your-perfect-companion-to-work-play-and-more", "global"),
  s7fe: official("https://news.samsung.com/global/introducing-the-newest-members-of-the-samsung-galaxy-tab-portfolio-galaxy-tab-s7-fe-and-galaxy-tab-a7-lite", "global"),
  a11: official("https://news.samsung.com/de/samsung-galaxy-tab-a11-serie-leistungsstarke-tablets-im-samsung-premium-design", "global"),
  a9: official("https://news.samsung.com/global/samsung-galaxy-tab-a9-and-galaxy-tab-a9-entertainment-and-productivity-engineered-for-everyone", "global"),
  a8: official("https://news.samsung.com/uk/introducing-samsungs-new-galaxy-tab-a8-more-screen-more-power-and-more-performance", "global"),
  a7: official("https://news.samsung.com/us/galaxy-tab-a7-availability/", "global"),
  s6lite2020: official("https://news.samsung.com/global/create-learn-and-relax-with-the-stylish-galaxy-tab-s6-lite", "global"),
  s6lite2022: official("https://news.samsung.com/de/viel-erreichen-wenig-aufwand-das-samsung-galaxy-tab-s6-lite-2022-edition", "global"),
  s6lite2024: official("https://www.samsung.com/th/tablets/galaxy-tab-s/galaxy-tab-s6-lite-gray-128gb-sm-p625nzaethl/"),
};

function galaxy(id: string, model: string, year: number, storage: string[], displaySize: string, source: CatalogSource, ram?: string | Array<[string, string]>, cellular = true): CatalogDevice {
  const pairings = Array.isArray(ram) ? ram : undefined;
  return tablet({
    id, brandId: "samsung", brand: "Samsung", model: `Galaxy Tab ${model}`, releaseYear: year, storage,
    ram: pairings?.[0]?.[0] ?? (typeof ram === "string" ? ram : undefined),
    displaySize, cellular, stylus: model.startsWith("S"), sources: [source],
    configurations: pairings?.map(([memory, capacity]) => ({ ram: [memory], storage: [capacity] })),
  });
}

const samsungTablets: CatalogDevice[] = [
  galaxy("device-galaxy-tab-s11", "S11", 2025, ["128GB", "256GB", "512GB"], "11-inch", samsungSources.s11, "12GB"),
  galaxy("device-galaxy-tab-s11-ultra", "S11 Ultra", 2025, ["256GB", "512GB", "1TB"], "14.6-inch", samsungSources.s11, [["12GB", "256GB"], ["12GB", "512GB"], ["16GB", "1TB"]]),
  galaxy("device-galaxy-tab-s10-plus", "S10+", 2024, ["256GB", "512GB"], "12.4-inch", samsungSources.s10, "12GB"),
  galaxy("device-galaxy-tab-s10-ultra", "S10 Ultra", 2024, ["256GB", "512GB", "1TB"], "14.6-inch", samsungSources.s10, [["12GB", "256GB"], ["12GB", "512GB"], ["16GB", "1TB"]]),
  galaxy("device-galaxy-tab-s10-fe", "S10 FE", 2025, ["128GB", "256GB"], "10.9-inch", samsungSources.s10fe, [["8GB", "128GB"], ["12GB", "256GB"]]),
  galaxy("device-galaxy-tab-s10-fe-plus", "S10 FE+", 2025, ["128GB", "256GB"], "13.1-inch", samsungSources.s10fe, [["8GB", "128GB"], ["12GB", "256GB"]]),
  galaxy("device-galaxy-tab-s10-lite", "S10 Lite", 2025, ["128GB", "256GB"], "10.9-inch", samsungSources.s10lite, [["6GB", "128GB"], ["8GB", "256GB"]]),
  galaxy("device-galaxy-tab-s9", "S9", 2023, ["128GB", "256GB"], "11-inch", samsungSources.s9, [["8GB", "128GB"], ["12GB", "256GB"]]),
  galaxy("device-galaxy-tab-s9-plus", "S9+", 2023, ["256GB", "512GB"], "12.4-inch", samsungSources.s9, "12GB"),
  galaxy("device-galaxy-tab-s9-ultra", "S9 Ultra", 2023, ["256GB", "512GB", "1TB"], "14.6-inch", samsungSources.s9, [["12GB", "256GB"], ["12GB", "512GB"], ["16GB", "1TB"]]),
  galaxy("device-galaxy-tab-s9-fe", "S9 FE", 2023, ["128GB", "256GB"], "10.9-inch", samsungSources.s9fe, [["6GB", "128GB"], ["8GB", "256GB"]]),
  galaxy("device-galaxy-tab-s9-fe-plus", "S9 FE+", 2023, ["128GB", "256GB"], "12.4-inch", samsungSources.s9fe, [["8GB", "128GB"], ["12GB", "256GB"]]),
  galaxy("device-galaxy-tab-s8", "S8", 2022, ["128GB", "256GB"], "11-inch", samsungSources.s8, "8GB"),
  galaxy("device-galaxy-tab-s8-plus", "S8+", 2022, ["128GB", "256GB"], "12.4-inch", samsungSources.s8, "8GB"),
  galaxy("device-galaxy-tab-s8-ultra", "S8 Ultra", 2022, ["128GB", "256GB", "512GB"], "14.6-inch", samsungSources.s8, [["8GB", "128GB"], ["12GB", "256GB"], ["16GB", "512GB"]]),
  galaxy("device-galaxy-tab-s7", "S7", 2020, ["128GB"], "11-inch", samsungSources.s7, "6GB"),
  galaxy("device-galaxy-tab-s7-plus", "S7+", 2020, ["128GB"], "12.4-inch", samsungSources.s7, "6GB"),
  galaxy("device-galaxy-tab-s7-fe", "S7 FE", 2021, ["64GB", "128GB"], "12.4-inch", samsungSources.s7fe, [["4GB", "64GB"], ["6GB", "128GB"]]),
  galaxy("device-galaxy-tab-a11", "A11", 2025, ["64GB"], "8.7-inch", samsungSources.a11, "4GB"),
  galaxy("device-galaxy-tab-a11-plus", "A11+", 2025, ["128GB", "256GB"], "11-inch", samsungSources.a11, [["6GB", "128GB"], ["8GB", "256GB"]]),
  galaxy("device-galaxy-tab-a9", "A9", 2023, ["64GB", "128GB"], "8.7-inch", samsungSources.a9, [["4GB", "64GB"], ["8GB", "128GB"]]),
  galaxy("device-galaxy-tab-a9-plus", "A9+", 2023, ["64GB", "128GB"], "11-inch", samsungSources.a9, [["4GB", "64GB"], ["8GB", "128GB"]]),
  galaxy("device-galaxy-tab-a8", "A8", 2021, ["32GB", "64GB"], "10.5-inch", samsungSources.a8, [["3GB", "32GB"], ["4GB", "64GB"]]),
  galaxy("device-galaxy-tab-a7", "A7", 2020, ["32GB", "64GB"], "10.4-inch", samsungSources.a7, "3GB"),
  galaxy("device-galaxy-tab-a7-lite", "A7 Lite", 2021, ["32GB", "64GB"], "8.7-inch", samsungSources.s7fe, [["3GB", "32GB"], ["4GB", "64GB"]]),
  galaxy("device-galaxy-tab-s6-lite-2020", "S6 Lite (2020)", 2020, ["64GB", "128GB"], "10.4-inch", samsungSources.s6lite2020, "4GB"),
  galaxy("device-galaxy-tab-s6-lite-2022", "S6 Lite (2022)", 2022, ["64GB", "128GB"], "10.4-inch", samsungSources.s6lite2022, "4GB"),
  galaxy("device-galaxy-tab-s6-lite-2024", "S6 Lite (2024)", 2024, ["64GB", "128GB"], "10.4-inch", samsungSources.s6lite2024, "4GB"),
];

const otherTablets: CatalogDevice[] = [
  tablet({ id: "device-pixel-tablet", brandId: "google", brand: "Google", model: "Pixel Tablet", releaseYear: 2023, storage: ["128GB", "256GB"], ram: "8GB", displaySize: "10.95-inch", sources: [official("https://support.google.com/googlepixeltablet/answer/13555146?hl=en", "global")] }),

  tablet({ id: "device-xiaomi-pad-5", brandId: "xiaomi", brand: "Xiaomi", model: "Xiaomi Pad 5", releaseYear: 2021, storage: ["128GB", "256GB"], ram: "6GB", displaySize: "11-inch", stylus: true, sources: [official("https://www.mi.com/global/product/xiaomi-pad-5/specs/", "global")] }),
  tablet({ id: "device-xiaomi-pad-6", brandId: "xiaomi", brand: "Xiaomi", model: "Xiaomi Pad 6", releaseYear: 2023, storage: ["128GB", "256GB"], ram: "6GB", displaySize: "11-inch", stylus: true, configurations: memoryStorage(["6GB", "128GB"], ["8GB", "128GB"], ["8GB", "256GB"]), sources: [official("https://www.mi.com/th/product/xiaomi-pad-6/specs/")] }),
  tablet({ id: "device-xiaomi-pad-7", brandId: "xiaomi", brand: "Xiaomi", model: "Xiaomi Pad 7", releaseYear: 2024, storage: ["128GB", "256GB"], ram: "8GB", displaySize: "11.2-inch", stylus: true, configurations: memoryStorage(["8GB", "128GB"], ["8GB", "256GB"], ["12GB", "256GB"]), sources: [official("https://www.mi.com/th/product/xiaomi-pad-7/specs/")] }),
  tablet({ id: "device-xiaomi-pad-7-pro", brandId: "xiaomi", brand: "Xiaomi", model: "Xiaomi Pad 7 Pro", releaseYear: 2024, storage: ["128GB", "256GB", "512GB"], ram: "8GB", displaySize: "11.2-inch", stylus: true, configurations: memoryStorage(["8GB", "128GB"], ["8GB", "256GB"], ["12GB", "512GB"]), sources: [official("https://www.mi.com/se/product/xiaomi-pad-7-pro/specs/", "regional")] }),
  tablet({ id: "device-xiaomi-pad-8", brandId: "xiaomi", brand: "Xiaomi", model: "Xiaomi Pad 8", releaseYear: 2025, storage: ["128GB", "256GB", "512GB"], ram: "8GB", displaySize: "11.2-inch", stylus: true, configurations: memoryStorage(["8GB", "128GB"], ["8GB", "256GB"], ["12GB", "512GB"]), sources: [official("https://www.mi.com/th/product/xiaomi-pad-8/specs/")] }),
  tablet({ id: "device-xiaomi-pad-8-pro", brandId: "xiaomi", brand: "Xiaomi", model: "Xiaomi Pad 8 Pro", releaseYear: 2025, storage: ["256GB", "512GB"], ram: "8GB", displaySize: "11.2-inch", stylus: true, configurations: memoryStorage(["8GB", "256GB"], ["12GB", "512GB"]), sources: [official("https://www.mi.com/tw/product/xiaomi-pad-8-pro/specs/", "regional")] }),
  tablet({ id: "device-redmi-pad", brandId: "xiaomi", brand: "Xiaomi", model: "Redmi Pad", releaseYear: 2022, storage: ["64GB", "128GB"], ram: "3GB", displaySize: "10.61-inch", configurations: memoryStorage(["3GB", "64GB"], ["4GB", "128GB"], ["6GB", "128GB"]), sources: [official("https://www.mi.com/th/product/redmi-pad/specs/")] }),
  tablet({ id: "device-redmi-pad-se", brandId: "xiaomi", brand: "Xiaomi", model: "Redmi Pad SE", releaseYear: 2023, storage: ["128GB"], ram: "6GB", displaySize: "11-inch", sources: [official("https://www.mi.com/th/product/redmi-pad-se/")] }),
  tablet({ id: "device-redmi-pad-pro", brandId: "xiaomi", brand: "Xiaomi", model: "Redmi Pad Pro", releaseYear: 2024, storage: ["128GB", "256GB"], ram: "6GB", displaySize: "12.1-inch", stylus: true, configurations: memoryStorage(["6GB", "128GB"], ["8GB", "128GB"], ["8GB", "256GB"]), sources: [official("https://www.mi.com/at/product/redmi-pad-pro/specs/", "regional")] }),
  tablet({ id: "device-redmi-pad-2", brandId: "xiaomi", brand: "Xiaomi", model: "Redmi Pad 2", releaseYear: 2025, storage: ["128GB", "256GB"], ram: "4GB", displaySize: "11-inch", stylus: true, configurations: memoryStorage(["4GB", "128GB"], ["6GB", "128GB"], ["8GB", "256GB"]), sources: [official("https://www.mi.com/th/product/redmi-pad-2/specs/")] }),

  tablet({ id: "device-oneplus-pad", brandId: "oneplus", brand: "OnePlus", model: "OnePlus Pad", releaseYear: 2023, storage: ["128GB"], ram: "8GB", displaySize: "11.61-inch", stylus: true, sources: [official("https://www.oneplus.com/us/oneplus-pad/specs", "global")] }),
  tablet({ id: "device-oneplus-pad-go", brandId: "oneplus", brand: "OnePlus", model: "OnePlus Pad Go", releaseYear: 2023, storage: ["128GB"], ram: "8GB", displaySize: "11.35-inch", sources: [official("https://www.oneplus.com/ee/oneplus-pad-go/specs", "regional")] }),
  tablet({ id: "device-oneplus-pad-2", brandId: "oneplus", brand: "OnePlus", model: "OnePlus Pad 2", releaseYear: 2024, storage: ["256GB"], ram: "12GB", displaySize: "12.1-inch", stylus: true, sources: [official("https://www.oneplus.com/us/oneplus-pad-2/specs", "global")] }),
  tablet({ id: "device-oneplus-pad-3", brandId: "oneplus", brand: "OnePlus", model: "OnePlus Pad 3", releaseYear: 2025, storage: ["256GB"], ram: "12GB", displaySize: "13.2-inch", stylus: true, sources: [official("https://www.oneplus.com/us/press/press-release/oneplus-launches-its-flagship-android-tablet-oneplus-pad3-in-the-united-states-and-canada", "global")] }),

  tablet({ id: "device-oppo-pad-air", brandId: "oppo", brand: "OPPO", model: "OPPO Pad Air", releaseYear: 2022, storage: ["64GB"], ram: "4GB", displaySize: "10.36-inch", sources: [official("https://www.oppo.com/th/accessories/oppo-pad-air/")] }),
  tablet({ id: "device-oppo-pad-2", brandId: "oppo", brand: "OPPO", model: "OPPO Pad 2", releaseYear: 2023, storage: ["256GB"], ram: "8GB", displaySize: "11.61-inch", stylus: true, sources: [official("https://www.oppo.com/th/accessories/oppo-pad-2/")] }),
  tablet({ id: "device-oppo-pad-neo", brandId: "oppo", brand: "OPPO", model: "OPPO Pad Neo", releaseYear: 2024, storage: ["128GB"], ram: "8GB", displaySize: "11.4-inch", network: "Wi-Fi + Cellular", sources: [official("https://www.oppo.com/th/accessories/oppo-pad-neo/specs/")] }),
  tablet({ id: "device-oppo-pad-3-matte", brandId: "oppo", brand: "OPPO", model: "OPPO Pad 3 Matte Display Edition", releaseYear: 2025, storage: ["256GB"], ram: "8GB", stylus: true, sources: [official("https://www.oppo.com/my/accessories/oppo-pad-3-matte-display-edition/specs/", "regional"), official("https://www.oppo.com/th/accessories/oppo-pad-3-matte-display-edition/")] }),

  tablet({ id: "device-honor-pad-9", brandId: "honor", brand: "HONOR", model: "HONOR Pad 9", releaseYear: 2024, storage: ["256GB"], ram: "8GB", displaySize: "12.1-inch", stylus: true, sources: [official("https://www.honor.com/th/tablets/honor-pad-9/")] }),
  tablet({ id: "device-honor-pad-8", brandId: "honor", brand: "HONOR", model: "HONOR Pad 8", releaseYear: 2022, storage: ["128GB"], ram: "6GB", displaySize: "12-inch", sources: [official("https://www.honor.com/th/tablets/honor-pad-8/spec/")] }),
  tablet({ id: "device-honor-pad-10", brandId: "honor", brand: "HONOR", model: "HONOR Pad 10", releaseYear: 2025, storage: ["256GB"], ram: "8GB", displaySize: "12.1-inch", cellular: true, stylus: true, sources: [official("https://www.honor.com/my/tablets/honor-pad-10/spec/", "regional")] }),
  tablet({ id: "device-honor-pad-x9", brandId: "honor", brand: "HONOR", model: "HONOR Pad X9", releaseYear: 2023, storage: ["128GB"], ram: "4GB", displaySize: "11.5-inch", sources: [official("https://www.honor.com/th/tablets/honor-pad-x9/spec/")] }),
  tablet({ id: "device-honor-pad-x8a", brandId: "honor", brand: "HONOR", model: "HONOR Pad X8a", releaseYear: 2024, storage: ["128GB"], ram: "4GB", displaySize: "11-inch", sources: [official("https://www.honor.com/th/tablets/honor-pad-x8a/spec/")] }),
  tablet({ id: "device-honor-pad-x9a", brandId: "honor", brand: "HONOR", model: "HONOR Pad X9a", releaseYear: 2025, storage: ["128GB"], ram: "8GB", displaySize: "11.5-inch", sources: [official("https://www.honor.com/th/tablets/honor-pad-x9a/")] }),

  tablet({ id: "device-huawei-matepad-11-5-2025", brandId: "huawei", brand: "Huawei", model: "HUAWEI MatePad 11.5 (2025)", releaseYear: 2025, storage: ["256GB"], ram: "8GB", displaySize: "11.5-inch", stylus: true, sources: [official("https://consumer.huawei.com/th/tablets/matepad-11-5-2025/specs/")] }),
  tablet({ id: "device-huawei-matepad-11-5-2024", brandId: "huawei", brand: "Huawei", model: "HUAWEI MatePad 11.5 (2024)", releaseYear: 2024, storage: ["128GB"], ram: "6GB", displaySize: "11.5-inch", stylus: true, sources: [official("https://consumer.huawei.com/en/tablets/matepad-11-5/specs/", "global")] }),
  tablet({ id: "device-huawei-matepad-11-2023", brandId: "huawei", brand: "Huawei", model: "HUAWEI MatePad 11 (2023)", releaseYear: 2023, storage: ["128GB"], ram: "6GB", displaySize: "11-inch", stylus: true, sources: [official("https://consumer.huawei.com/co/tablets/matepad-11-2023/specs/", "regional")] }),
  tablet({ id: "device-huawei-matepad-se-11", brandId: "huawei", brand: "Huawei", model: "HUAWEI MatePad SE 11", releaseYear: 2024, storage: ["128GB"], ram: "6GB", displaySize: "11-inch", cellular: true, stylus: true, configurations: [{ ram: ["6GB"], network: ["Wi-Fi"] }, { ram: ["8GB"], network: ["Wi-Fi + Cellular"] }], sources: [official("https://consumer.huawei.com/th/tablets/matepad-se-11/specs/")] }),
  tablet({ id: "device-huawei-matepad-12-x-2025", brandId: "huawei", brand: "Huawei", model: "HUAWEI MatePad 12 X (2025)", releaseYear: 2025, storage: ["256GB"], ram: "12GB", displaySize: "12-inch", stylus: true, sources: [official("https://consumer.huawei.com/uk/tablets/matepad-12-x-2025/specs/", "regional")] }),
  tablet({ id: "device-huawei-matepad-pro-12-2-2025", brandId: "huawei", brand: "Huawei", model: "HUAWEI MatePad Pro 12.2 (2025)", releaseYear: 2025, storage: ["256GB", "512GB"], ram: "12GB", displaySize: "12.2-inch", stylus: true, sources: [official("https://consumer.huawei.com/ae-en/tablets/matepad-pro-12-2/specs/", "regional"), official("https://consumer.huawei.com/en/support/tablets/matepad-pro-12-2/", "global"), official("https://consumer.huawei.com/th/support/content/th-th00737675/")] }),
  tablet({ id: "device-huawei-matepad-pro-12-2-2024", brandId: "huawei", brand: "Huawei", model: "HUAWEI MatePad Pro 12.2 (2024)", releaseYear: 2024, storage: ["256GB", "512GB"], ram: "12GB", displaySize: "12.2-inch", stylus: true, sources: [official("https://consumer.huawei.com/uk/tablets/matepad-pro-12-2-2024/specs/", "regional")] }),

  tablet({ id: "device-realme-pad", brandId: "realme", brand: "realme", model: "realme Pad", releaseYear: 2021, storage: ["64GB"], ram: "4GB", displaySize: "10.4-inch", sources: [official("https://www.realme.com/th/realme-pad")] }),
  tablet({ id: "device-realme-pad-mini", brandId: "realme", brand: "realme", model: "realme Pad Mini", releaseYear: 2022, storage: ["64GB"], ram: "4GB", displaySize: "8.7-inch", cellular: true, sources: [official("https://www.realme.com/th/realme-pad-mini")] }),
];

export const tabletCatalog: CatalogDevice[] = [...appleTablets, ...samsungTablets, ...otherTablets];
