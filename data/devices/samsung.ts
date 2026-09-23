import { official, phone } from "./helpers";

const s26 = official("https://www.samsung.com/th/smartphones/galaxy-s26/specs/");
const s25 = official("https://www.samsung.com/th/smartphones/galaxy-s25-ultra/specs/");
const s24 = official("https://www.samsung.com/th/smartphones/galaxy-s24-ultra/");
const fold7 = official("https://news.samsung.com/th/galaxy-z-fold7-and-galaxy-z-flip7-pre-order");

export const samsungPhones = [
  phone({ id: "device-samsung-s26", brandId: "samsung", brand: "Samsung", model: "Galaxy S26", releaseYear: 2026, sortOrder: 10, storage: ["256GB", "512GB"], sources: [s26] }),
  phone({ id: "device-samsung-s26-plus", brandId: "samsung", brand: "Samsung", model: "Galaxy S26+", releaseYear: 2026, sortOrder: 20, storage: ["256GB", "512GB"], sources: [s26] }),
  phone({ id: "device-samsung-s26-ultra", brandId: "samsung", brand: "Samsung", model: "Galaxy S26 Ultra", releaseYear: 2026, sortOrder: 30, storage: ["256GB", "512GB", "1TB"], sources: [s26] }),
  phone({ id: "device-samsung-z-fold7", brandId: "samsung", brand: "Samsung", model: "Galaxy Z Fold7", releaseYear: 2025, sortOrder: 5, storage: ["256GB", "512GB", "1TB"], sources: [fold7] }),
  phone({ id: "device-samsung-s25", brandId: "samsung", brand: "Samsung", model: "Galaxy S25", releaseYear: 2025, sortOrder: 10, storage: ["256GB", "512GB"], sources: [s25] }),
  phone({ id: "device-samsung-s25-plus", brandId: "samsung", brand: "Samsung", model: "Galaxy S25+", releaseYear: 2025, sortOrder: 20, storage: ["256GB", "512GB"], sources: [s25] }),
  phone({ id: "device-samsung-s25-ultra", brandId: "samsung", brand: "Samsung", model: "Galaxy S25 Ultra", releaseYear: 2025, sortOrder: 30, storage: ["256GB", "512GB", "1TB"], sources: [s25] }),
  phone({ id: "device-samsung-s24", brandId: "samsung", brand: "Samsung", model: "Galaxy S24", releaseYear: 2024, sortOrder: 10, storage: ["256GB", "512GB"], sources: [s24] }),
  phone({ id: "device-samsung-s24-plus", brandId: "samsung", brand: "Samsung", model: "Galaxy S24+", releaseYear: 2024, sortOrder: 20, storage: ["256GB", "512GB"], sources: [s24] }),
  phone({ id: "device-samsung-s24-ultra", brandId: "samsung", brand: "Samsung", model: "Galaxy S24 Ultra", variant: "512GB", releaseYear: 2024, sortOrder: 30, storage: ["256GB", "512GB", "1TB"], colors: ["Titanium Gray"], defaultStorage: "512GB", defaultColor: "Titanium Gray", sources: [s24] }),
];
