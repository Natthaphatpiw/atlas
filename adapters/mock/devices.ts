import type { Device } from "@/domain/types";

export const mockDevices: Device[] = [
  {
    id: "device-iphone-15-pro",
    category: "phone",
    brand: "Apple",
    model: "iPhone 15 Pro",
    variant: "256GB",
    specs: {
      storage: "256GB",
      color: "Natural Titanium",
      network: "5G",
    },
    marketHints: ["Popular with premium resale demand", "Strong local demand"],
    createdAt: "2026-09-20T00:00:00.000Z",
  },
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
