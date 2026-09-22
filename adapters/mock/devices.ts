import type { Device } from "@/domain/types";

// Frontend UX fixtures, not production inventory or canonical backend IDs.
// iPhone capacities/finishes: https://support.apple.com/en-al/108044
export type MockCatalogDevice = Device & {
  specOptions?: Partial<Record<keyof Device["specs"], string[]>>;
};

const mockCreatedAt = "2026-09-20T00:00:00.000Z";

function createIPhone(
  id: string,
  model: string,
  storage: string[],
  color: string[],
  defaults: { storage?: string; color?: string } = {},
): MockCatalogDevice {
  return {
    id,
    category: "phone",
    brand: "Apple",
    model,
    specs: {
      storage: defaults.storage ?? storage[0],
      color: defaults.color ?? color[0],
      network: "5G",
    },
    specOptions: {
      storage,
      color,
    },
    marketHints: ["Mock catalog configuration"],
    createdAt: mockCreatedAt,
  };
}

export const mockDevices: MockCatalogDevice[] = [
  // iPhone 17 family
  createIPhone("device-iphone-17", "iPhone 17", ["256GB", "512GB"], ["Black", "White", "Mist Blue", "Sage", "Lavender"]),
  createIPhone("device-iphone-air", "iPhone Air", ["256GB", "512GB", "1TB"], ["Space Black", "Cloud White", "Light Gold", "Sky Blue"]),
  createIPhone("device-iphone-17-pro", "iPhone 17 Pro", ["256GB", "512GB", "1TB"], ["Silver", "Cosmic Orange", "Deep Blue"]),
  createIPhone("device-iphone-17-pro-max", "iPhone 17 Pro Max", ["256GB", "512GB", "1TB", "2TB"], ["Silver", "Cosmic Orange", "Deep Blue"]),

  // iPhone 16 family
  createIPhone("device-iphone-16", "iPhone 16", ["128GB", "256GB", "512GB"], ["Black", "White", "Pink", "Teal", "Ultramarine"]),
  createIPhone("device-iphone-16-plus", "iPhone 16 Plus", ["128GB", "256GB", "512GB"], ["Black", "White", "Pink", "Teal", "Ultramarine"]),
  createIPhone("device-iphone-16-pro", "iPhone 16 Pro", ["128GB", "256GB", "512GB", "1TB"], ["Black Titanium", "White Titanium", "Natural Titanium", "Desert Titanium"]),
  createIPhone("device-iphone-16-pro-max", "iPhone 16 Pro Max", ["256GB", "512GB", "1TB"], ["Black Titanium", "White Titanium", "Natural Titanium", "Desert Titanium"]),

  // iPhone 15 family
  createIPhone("device-iphone-15", "iPhone 15", ["128GB", "256GB", "512GB"], ["Black", "Blue", "Green", "Yellow", "Pink"]),
  createIPhone("device-iphone-15-plus", "iPhone 15 Plus", ["128GB", "256GB", "512GB"], ["Black", "Blue", "Green", "Yellow", "Pink"]),
  createIPhone(
    "device-iphone-15-pro",
    "iPhone 15 Pro",
    ["128GB", "256GB", "512GB", "1TB"],
    ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"],
    { storage: "256GB", color: "Natural Titanium" },
  ),
  createIPhone("device-iphone-15-pro-max", "iPhone 15 Pro Max", ["256GB", "512GB", "1TB"], ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"]),

  // iPhone 14 family
  createIPhone("device-iphone-14", "iPhone 14", ["128GB", "256GB", "512GB"], ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"]),
  createIPhone("device-iphone-14-plus", "iPhone 14 Plus", ["128GB", "256GB", "512GB"], ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"]),
  createIPhone("device-iphone-14-pro", "iPhone 14 Pro", ["128GB", "256GB", "512GB", "1TB"], ["Silver", "Gold", "Space Black", "Deep Purple"]),
  createIPhone("device-iphone-14-pro-max", "iPhone 14 Pro Max", ["128GB", "256GB", "512GB", "1TB"], ["Silver", "Gold", "Space Black", "Deep Purple"]),

  // iPhone 13 family
  createIPhone("device-iphone-13", "iPhone 13", ["128GB", "256GB", "512GB"], ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"]),
  createIPhone("device-iphone-13-mini", "iPhone 13 mini", ["128GB", "256GB", "512GB"], ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"]),
  createIPhone("device-iphone-13-pro", "iPhone 13 Pro", ["128GB", "256GB", "512GB", "1TB"], ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"]),
  createIPhone("device-iphone-13-pro-max", "iPhone 13 Pro Max", ["128GB", "256GB", "512GB", "1TB"], ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"]),

  {
    id: "device-samsung-s24-ultra",
    category: "phone",
    brand: "Samsung",
    model: "Galaxy S24 Ultra",
    variant: "512GB",
    specs: {
      storage: "512GB",
      color: "Titanium Gray",
      network: "5G",
    },
    marketHints: ["High resale interest", "Strong premium segment"],
    createdAt: "2026-09-20T00:00:00.000Z",
  },
  {
    id: "device-macbook-air-m3",
    category: "laptop",
    brand: "Apple",
    model: "MacBook Air",
    variant: "M3 13-inch",
    specs: {
      ram: "16GB",
      displaySize: "13.6-inch",
      storage: "512GB",
    },
    marketHints: ["Strong commercial demand"],
    createdAt: "2026-09-20T00:00:00.000Z",
  },
];
