import { official, phone } from "./helpers";

const pixelSupport = official("https://support.google.com/pixelphone/answer/7158570?hl=en", "global");

export const googlePhones = [
  phone({ id: "device-google-pixel-10", brandId: "google", brand: "Google", model: "Pixel 10", releaseYear: 2025, sortOrder: 10, storage: ["128GB", "256GB"], sources: [official("https://store.google.com/config/pixel_10", "regional"), pixelSupport], regional: true }),
  phone({ id: "device-google-pixel-10-pro", brandId: "google", brand: "Google", model: "Pixel 10 Pro", releaseYear: 2025, sortOrder: 20, storage: ["128GB", "256GB", "512GB", "1TB"], sources: [official("https://store.google.com/config/pixel_10_pro", "regional"), pixelSupport], regional: true }),
  phone({ id: "device-google-pixel-10-pro-xl", brandId: "google", brand: "Google", model: "Pixel 10 Pro XL", releaseYear: 2025, sortOrder: 30, storage: ["256GB", "512GB", "1TB"], sources: [official("https://store.google.com/config/pixel_10_pro", "regional"), pixelSupport], regional: true }),
  phone({ id: "device-google-pixel-10-pro-fold", brandId: "google", brand: "Google", model: "Pixel 10 Pro Fold", releaseYear: 2025, sortOrder: 40, storage: ["256GB", "512GB", "1TB"], sources: [official("https://store.google.com/config/pixel_10_pro_fold", "regional"), pixelSupport], regional: true }),
  phone({ id: "device-google-pixel-9a", brandId: "google", brand: "Google", model: "Pixel 9a", releaseYear: 2025, sortOrder: 50, storage: ["128GB", "256GB"], sources: [official("https://store.google.com/config/pixel_9a", "regional"), pixelSupport], regional: true }),
];
