import type { CatalogConfiguration, CatalogDevice } from "@/domain/device-catalog";
import { catalogItem, official, options } from "./helpers";

/**
 * Model generations are identified using Apple's Mac identification pages.
 * Each linked Apple technical-specification page verifies the listed memory
 * and storage choices. Chip tiers that constrain memory are separate models.
 * The existing M3 13-inch Air keeps its stable ID and saved default specs.
 */
type MacRow = readonly [string, string, number, string, string, string, number];

const rows: MacRow[] = [
  ["device-macbook-air-intel-2020", "MacBook Air (Intel, 13-inch, 2020)", 2020, "8GB,16GB", "256GB,512GB,1TB,2TB", "13.3", 111991],
  ["device-macbook-air-m1-2020", "MacBook Air (M1, 2020)", 2020, "8GB,16GB", "256GB,512GB,1TB,2TB", "13.3", 111883],
  ["device-macbook-air-m2-13", "MacBook Air (M2, 13-inch)", 2022, "8GB,16GB,24GB", "256GB,512GB,1TB,2TB", "13.6", 111867],
  ["device-macbook-air-m2-15", "MacBook Air (M2, 15-inch)", 2023, "8GB,16GB,24GB", "256GB,512GB,1TB,2TB", "15.3", 111346],
  ["device-macbook-air-m3", "MacBook Air (M3, 13-inch)", 2024, "8GB,16GB,24GB", "256GB,512GB,1TB,2TB", "13.6", 118551],
  ["device-macbook-air-m3-15", "MacBook Air (M3, 15-inch)", 2024, "8GB,16GB,24GB", "256GB,512GB,1TB,2TB", "15.3", 118552],
  ["device-macbook-air-m4-13", "MacBook Air (M4, 13-inch)", 2025, "16GB,24GB,32GB", "256GB,512GB,1TB,2TB", "13.6", 122209],
  ["device-macbook-air-m4-15", "MacBook Air (M4, 15-inch)", 2025, "16GB,24GB,32GB", "256GB,512GB,1TB,2TB", "15.3", 122210],
  ["device-macbook-air-m5-13", "MacBook Air (M5, 13-inch)", 2026, "16GB,24GB,32GB", "512GB,1TB,2TB,4TB", "13.6", 126320],
  ["device-macbook-air-m5-15", "MacBook Air (M5, 15-inch)", 2026, "16GB,24GB,32GB", "512GB,1TB,2TB,4TB", "15.3", 126321],
  ["device-macbook-pro-intel-2port-2020", "MacBook Pro (Intel, 13-inch, 2 ports, 2020)", 2020, "8GB,16GB", "256GB,512GB,1TB,2TB", "13.3", 111981],
  ["device-macbook-pro-intel-4port-2020", "MacBook Pro (Intel, 13-inch, 4 ports, 2020)", 2020, "16GB,32GB", "512GB,1TB,2TB,4TB", "13.3", 111339],
  ["device-macbook-pro-m1-13", "MacBook Pro (M1, 13-inch)", 2020, "8GB,16GB", "256GB,512GB,1TB,2TB", "13.3", 111893],
  ["device-macbook-pro-m1-pro-14", "MacBook Pro (M1 Pro, 14-inch)", 2021, "16GB,32GB", "512GB,1TB,2TB,4TB,8TB", "14.2", 111902],
  ["device-macbook-pro-m1-max-14", "MacBook Pro (M1 Max, 14-inch)", 2021, "32GB,64GB", "1TB,2TB,4TB,8TB", "14.2", 111902],
  ["device-macbook-pro-m1-pro-16", "MacBook Pro (M1 Pro, 16-inch)", 2021, "16GB,32GB", "512GB,1TB,2TB,4TB,8TB", "16.2", 111901],
  ["device-macbook-pro-m1-max-16", "MacBook Pro (M1 Max, 16-inch)", 2021, "32GB,64GB", "1TB,2TB,4TB,8TB", "16.2", 111901],
  ["device-macbook-pro-m2-13", "MacBook Pro (M2, 13-inch)", 2022, "8GB,16GB,24GB", "256GB,512GB,1TB,2TB", "13.3", 111869],
  ["device-macbook-pro-m2-pro-14", "MacBook Pro (M2 Pro, 14-inch)", 2023, "16GB,32GB", "512GB,1TB,2TB,4TB,8TB", "14.2", 111340],
  ["device-macbook-pro-m2-max-14", "MacBook Pro (M2 Max, 14-inch)", 2023, "32GB,64GB,96GB", "1TB,2TB,4TB,8TB", "14.2", 111340],
  ["device-macbook-pro-m2-pro-16", "MacBook Pro (M2 Pro, 16-inch)", 2023, "16GB,32GB", "512GB,1TB,2TB,4TB,8TB", "16.2", 111838],
  ["device-macbook-pro-m2-max-16", "MacBook Pro (M2 Max, 16-inch)", 2023, "32GB,64GB,96GB", "1TB,2TB,4TB,8TB", "16.2", 111838],
  ["device-macbook-pro-m3-14", "MacBook Pro (M3, 14-inch)", 2023, "8GB,16GB,24GB", "512GB,1TB,2TB", "14.2", 117735],
  ["device-macbook-pro-m3-pro-14", "MacBook Pro (M3 Pro, 14-inch)", 2023, "18GB,36GB", "512GB,1TB,2TB,4TB", "14.2", 117736],
  ["device-macbook-pro-m3-max-14", "MacBook Pro (M3 Max, 14-inch)", 2023, "36GB,48GB,64GB,96GB,128GB", "1TB,2TB,4TB,8TB", "14.2", 117736],
  ["device-macbook-pro-m3-pro-16", "MacBook Pro (M3 Pro, 16-inch)", 2023, "18GB,36GB", "512GB,1TB,2TB,4TB", "16.2", 117737],
  ["device-macbook-pro-m3-max-16", "MacBook Pro (M3 Max, 16-inch)", 2023, "36GB,48GB,64GB,96GB,128GB", "1TB,2TB,4TB,8TB", "16.2", 117737],
  ["device-macbook-pro-m4-14", "MacBook Pro (M4, 14-inch)", 2024, "16GB,24GB,32GB", "512GB,1TB,2TB", "14.2", 121552],
  ["device-macbook-pro-m4-pro-14", "MacBook Pro (M4 Pro, 14-inch)", 2024, "24GB,48GB", "512GB,1TB,2TB,4TB", "14.2", 121553],
  ["device-macbook-pro-m4-max-14", "MacBook Pro (M4 Max, 14-inch)", 2024, "36GB,48GB,64GB,128GB", "1TB,2TB,4TB,8TB", "14.2", 121553],
  ["device-macbook-pro-m4-pro-16", "MacBook Pro (M4 Pro, 16-inch)", 2024, "24GB,48GB", "512GB,1TB,2TB,4TB", "16.2", 121554],
  ["device-macbook-pro-m4-max-16", "MacBook Pro (M4 Max, 16-inch)", 2024, "36GB,48GB,64GB,128GB", "1TB,2TB,4TB,8TB", "16.2", 121554],
  ["device-macbook-pro-m5-14", "MacBook Pro (M5, 14-inch)", 2025, "16GB,24GB,32GB", "512GB,1TB,2TB,4TB", "14.2", 125405],
  ["device-macbook-pro-m5-pro-14", "MacBook Pro (M5 Pro, 14-inch)", 2026, "24GB,48GB,64GB", "1TB,2TB,4TB", "14.2", 126318],
  ["device-macbook-pro-m5-max-14", "MacBook Pro (M5 Max, 14-inch)", 2026, "36GB,48GB,64GB,128GB", "2TB,4TB,8TB", "14.2", 126318],
  ["device-macbook-pro-m5-pro-16", "MacBook Pro (M5 Pro, 16-inch)", 2026, "24GB,48GB,64GB", "1TB,2TB,4TB", "16.2", 126319],
  ["device-macbook-pro-m5-max-16", "MacBook Pro (M5 Max, 16-inch)", 2026, "36GB,48GB,64GB,128GB", "2TB,4TB,8TB", "16.2", 126319],
  ["device-imac-intel-27-2020", "iMac (Intel, Retina 5K, 27-inch, 2020)", 2020, "8GB,16GB,32GB,64GB,128GB", "256GB,512GB,1TB,2TB,4TB,8TB", "27", 111913],
  ["device-imac-m1-24", "iMac (M1, 24-inch, 4 ports)", 2021, "8GB,16GB", "256GB,512GB,1TB,2TB", "24", 111895],
  ["device-imac-m1-24-2port", "iMac (M1, 24-inch, 2 ports)", 2021, "8GB,16GB", "256GB,512GB,1TB", "24", 111895],
  ["device-imac-m3-24-4port", "iMac (M3, 24-inch, 4 ports)", 2023, "8GB,16GB,24GB", "256GB,512GB,1TB,2TB", "24", 117734],
  ["device-imac-m3-24-2port", "iMac (M3, 24-inch, 2 ports)", 2023, "8GB,16GB,24GB", "256GB,512GB,1TB", "24", 117733],
  ["device-imac-m4-24", "iMac (M4, 24-inch, 4 ports)", 2024, "16GB,24GB,32GB", "256GB,512GB,1TB,2TB", "24", 121557],
  ["device-imac-m4-24-2port", "iMac (M4, 24-inch, 2 ports)", 2024, "16GB,24GB", "256GB,512GB,1TB", "24", 121556],
  ["device-mac-mini-m1", "Mac mini (M1)", 2020, "8GB,16GB", "256GB,512GB,1TB,2TB", "", 111894],
  ["device-mac-mini-m2", "Mac mini (M2)", 2023, "8GB,16GB,24GB", "256GB,512GB,1TB,2TB", "", 111837],
  ["device-mac-mini-m2-pro", "Mac mini (M2 Pro)", 2023, "16GB,32GB", "512GB,1TB,2TB,4TB,8TB", "", 111837],
  ["device-mac-mini-m4", "Mac mini (M4)", 2024, "16GB,24GB,32GB", "256GB,512GB,1TB,2TB", "", 121555],
  ["device-mac-mini-m4-pro", "Mac mini (M4 Pro)", 2024, "24GB,48GB,64GB", "512GB,1TB,2TB,4TB,8TB", "", 121555],
  ["device-mac-mini-m6", "Mac mini (M6)", 2026, "16GB,24GB,32GB", "256GB,512GB,1TB,2TB", "", 128108],
  ["device-mac-mini-m5-pro", "Mac mini (M5 Pro)", 2026, "24GB,48GB,64GB", "512GB,1TB,2TB,4TB,8TB", "", 128108],
  ["device-mac-studio-m1-max", "Mac Studio (M1 Max)", 2022, "32GB,64GB", "512GB,1TB,2TB,4TB,8TB", "", 111900],
  ["device-mac-studio-m1-ultra", "Mac Studio (M1 Ultra)", 2022, "64GB,128GB", "1TB,2TB,4TB,8TB", "", 111900],
  ["device-mac-studio-m2-max", "Mac Studio (M2 Max)", 2023, "32GB,64GB,96GB", "512GB,1TB,2TB,4TB,8TB", "", 111835],
  ["device-mac-studio-m2-ultra", "Mac Studio (M2 Ultra)", 2023, "64GB,128GB,192GB", "1TB,2TB,4TB,8TB", "", 111835],
  ["device-mac-studio-m3-ultra", "Mac Studio (M3 Ultra)", 2025, "96GB,256GB", "1TB,2TB,4TB,8TB,16TB", "", 122211],
  ["device-mac-studio-m4-max", "Mac Studio (M4 Max)", 2025, "36GB,48GB,64GB,128GB", "512GB,1TB,2TB,4TB,8TB", "", 122211],
  ["device-mac-studio-m5-max", "Mac Studio (M5 Max)", 2026, "36GB,48GB,64GB,128GB", "512GB,1TB,2TB,4TB,8TB", "", 128107],
  ["device-mac-studio-m5-ultra", "Mac Studio (M5 Ultra)", 2026, "96GB,256GB,512GB", "1TB,2TB,4TB,8TB,16TB", "", 128107],
  ["device-mac-pro-m2-ultra", "Mac Pro (M2 Ultra)", 2023, "64GB,128GB,192GB", "1TB,2TB,4TB,8TB", "", 111343],
  ["device-mac-pro-rack-m2-ultra", "Mac Pro (Rack, M2 Ultra)", 2023, "64GB,128GB,192GB", "1TB,2TB,4TB,8TB", "", 111343],
];

const constrainedChips: Record<string, CatalogConfiguration[]> = {
  "device-macbook-air-intel-2020": [
    { chip: ["Intel Core i3"], ram: ["8GB", "16GB"], storage: ["256GB", "512GB", "1TB", "2TB"] },
    { chip: ["Intel Core i5"], ram: ["8GB", "16GB"], storage: ["256GB", "512GB", "1TB", "2TB"] },
    { chip: ["Intel Core i7"], ram: ["8GB", "16GB"], storage: ["256GB", "512GB", "1TB", "2TB"] },
  ],
  "device-macbook-pro-intel-2port-2020": [
    { chip: ["Intel Core i5"], ram: ["8GB", "16GB"], storage: ["256GB", "512GB", "1TB", "2TB"] },
    { chip: ["Intel Core i7"], ram: ["8GB", "16GB"], storage: ["256GB", "512GB", "1TB", "2TB"] },
  ],
  "device-macbook-pro-intel-4port-2020": [
    { chip: ["Intel Core i5"], ram: ["16GB", "32GB"], storage: ["512GB", "1TB", "2TB", "4TB"] },
    { chip: ["Intel Core i7"], ram: ["16GB", "32GB"], storage: ["512GB", "1TB", "2TB", "4TB"] },
  ],
  "device-imac-intel-27-2020": [
    { chip: ["Intel Core i5 (3.1GHz)"], ram: ["8GB", "16GB", "32GB", "64GB", "128GB"], storage: ["256GB"] },
    { chip: ["Intel Core i5 (3.3GHz)"], ram: ["8GB", "16GB", "32GB", "64GB", "128GB"], storage: ["512GB", "1TB", "2TB"] },
    { chip: ["Intel Core i7 (3.8GHz)"], ram: ["8GB", "16GB", "32GB", "64GB", "128GB"], storage: ["512GB", "1TB", "2TB", "4TB", "8TB"] },
    { chip: ["Intel Core i9 (3.6GHz)"], ram: ["8GB", "16GB", "32GB", "64GB", "128GB"], storage: ["512GB", "1TB", "2TB", "4TB", "8TB"] },
  ],
};

function chipConfigurations(id: string, chip: string, ram: string[], storage: string[]): CatalogConfiguration[] {
  const variant = (label: string, memory: string[]): CatalogConfiguration => ({ chip: [label], ram: memory, storage });
  if (id === "device-macbook-air-m3") return [
    variant("M3 (8-core CPU, 8-core GPU)", ram),
    variant("M3 (8-core CPU, 10-core GPU)", ram),
  ];
  if (/device-macbook-pro-m1-pro-14/.test(id)) return [
    variant("M1 Pro (8-core CPU, 14-core GPU)", ram),
    variant("M1 Pro (10-core CPU, 14-core GPU)", ram),
    variant("M1 Pro (10-core CPU, 16-core GPU)", ram),
  ];
  if (/device-macbook-pro-m1-pro-16/.test(id)) return [variant("M1 Pro (10-core CPU, 16-core GPU)", ram)];
  if (/device-macbook-pro-m1-max-/.test(id) || id === "device-mac-studio-m1-max") return [
    variant("M1 Max (10-core CPU, 24-core GPU)", ram),
    variant("M1 Max (10-core CPU, 32-core GPU)", ram),
  ];
  if (/device-macbook-pro-m2-max-/.test(id) || id === "device-mac-studio-m2-max") return [
    variant("M2 Max (12-core CPU, 30-core GPU)", ["32GB", "64GB"]),
    variant("M2 Max (12-core CPU, 38-core GPU)", ["32GB", "64GB", "96GB"]),
  ];
  if (id === "device-macbook-pro-m2-pro-14") return [
    variant("M2 Pro (10-core CPU, 16-core GPU)", ram),
    variant("M2 Pro (12-core CPU, 19-core GPU)", ram),
  ];
  if (id === "device-macbook-pro-m2-pro-16") return [variant("M2 Pro (12-core CPU, 19-core GPU)", ram)];
  if (id === "device-macbook-pro-m3-pro-16") return [variant("M3 Pro (12-core CPU, 18-core GPU)", ram)];
  if (/device-macbook-pro-m3-pro-/.test(id)) return [
    variant("M3 Pro (11-core CPU, 14-core GPU)", ram),
    variant("M3 Pro (12-core CPU, 18-core GPU)", ram),
  ];
  if (/device-macbook-pro-m3-max-/.test(id)) return [
    variant("M3 Max (14-core CPU, 30-core GPU)", ["36GB", "96GB"]),
    variant("M3 Max (16-core CPU, 40-core GPU)", ["48GB", "64GB", "128GB"]),
  ];
  if (id === "device-macbook-pro-m4-pro-16") return [variant("M4 Pro (14-core CPU, 20-core GPU)", ram)];
  if (/device-macbook-pro-m4-pro-/.test(id) || id === "device-mac-mini-m4-pro") return [
    variant("M4 Pro (12-core CPU, 16-core GPU)", ram),
    variant("M4 Pro (14-core CPU, 20-core GPU)", ram),
  ];
  if (/device-macbook-pro-m4-max-/.test(id) || id === "device-mac-studio-m4-max") return [
    variant("M4 Max (14-core CPU, 32-core GPU)", ["36GB"]),
    variant("M4 Max (16-core CPU, 40-core GPU)", ["48GB", "64GB", "128GB"]),
  ];
  if (id === "device-macbook-pro-m5-pro-16") return [variant("M5 Pro (18-core CPU, 20-core GPU)", ram)];
  if (/device-macbook-pro-m5-pro-/.test(id) || id === "device-mac-mini-m5-pro") return [
    variant("M5 Pro (15-core CPU, 16-core GPU)", ["24GB", "48GB"]),
    variant("M5 Pro (18-core CPU, 20-core GPU)", ["24GB", "48GB", "64GB"]),
  ];
  if (/device-macbook-pro-m5-max-/.test(id) || id === "device-mac-studio-m5-max") return [
    variant("M5 Max (18-core CPU, 32-core GPU)", ["36GB"]),
    variant("M5 Max (18-core CPU, 40-core GPU)", ["48GB", "64GB", "128GB"]),
  ];
  if (id === "device-mac-studio-m5-ultra") return [
    variant("M5 Ultra (30-core CPU, 64-core GPU)", ["96GB"]),
    variant("M5 Ultra (36-core CPU, 80-core GPU)", ["256GB", "512GB"]),
  ];
  if (id === "device-mac-studio-m3-ultra") return [
    variant("M3 Ultra (28-core CPU, 60-core GPU)", ram),
    variant("M3 Ultra (32-core CPU, 80-core GPU)", ram),
  ];
  return [variant(chip, ram)];
}

export const macCatalog: CatalogDevice[] = rows.map(([id, model, releaseYear, memory, capacity, screen, supportId]) => {
  const ram = memory.split(",");
  const storage = capacity.split(",");
  const chip = model.match(/\bM[1-6](?: Pro| Max| Ultra)?\b/)?.[0];
  const configurations: CatalogConfiguration[] = constrainedChips[id] ?? chipConfigurations(id, chip ?? "", ram, storage);
  const chips = configurations.flatMap((configuration) => configuration.chip ?? []);
  const category = id.includes("macbook") ? "laptop" : "desktop";
  const sortOrder = id.includes("macbook-air") ? 10 : id.includes("macbook-pro") ? 20 : id.includes("imac") ? 30 : id.includes("mac-mini") ? 40 : id.includes("mac-studio") ? 50 : 60;
  const device = catalogItem({
    id,
    category,
    brandId: "apple",
    brand: "Apple",
    model,
    releaseYear,
    sortOrder,
    specs: {
      chip: chips[0],
      ram: id === "device-macbook-air-m3" ? "16GB" : ram[0],
      storage: id === "device-macbook-air-m3" ? "512GB" : storage[0],
      ...(screen ? { displaySize: screen + "-inch" } : {}),
    },
    sources: [official("https://support.apple.com/en-us/" + supportId, "global")],
  });
  return { ...device, specOptions: { chip: options(chips), ram: options(ram), storage: options(storage) }, configurations };
});
