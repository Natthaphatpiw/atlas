import { official, phone } from "./helpers";

const xiaomi = (id: string, model: string, releaseYear: number, sortOrder: number, storage: string[], slug: string) =>
  phone({ id, brandId: "xiaomi", brand: "Xiaomi", model, releaseYear, sortOrder, storage, sources: [official(`https://www.mi.com/th/product/${slug}/specs/`)] });

export const xiaomiPhones = [
  xiaomi("device-xiaomi-15", "Xiaomi 15", 2025, 10, ["256GB", "512GB"], "xiaomi-15"),
  xiaomi("device-xiaomi-15-ultra", "Xiaomi 15 Ultra", 2025, 20, ["512GB", "1TB"], "xiaomi-15-ultra"),
  xiaomi("device-xiaomi-14", "Xiaomi 14", 2024, 10, ["256GB", "512GB"], "xiaomi-14"),
  xiaomi("device-xiaomi-14-ultra", "Xiaomi 14 Ultra", 2024, 20, ["512GB"], "xiaomi-14-ultra"),
  xiaomi("device-xiaomi-14t", "Xiaomi 14T", 2024, 30, ["256GB", "512GB"], "xiaomi-14t"),
  xiaomi("device-xiaomi-13t-pro", "Xiaomi 13T Pro", 2023, 10, ["256GB", "512GB", "1TB"], "xiaomi-13t-pro"),
  xiaomi("device-xiaomi-11-lite-5g-ne", "Xiaomi 11 Lite 5G NE", 2021, 10, ["128GB", "256GB"], "xiaomi-11-lite-5g-ne"),
  xiaomi("device-xiaomi-mi-11-lite", "Mi 11 Lite", 2021, 20, ["64GB", "128GB"], "mi-11-lite"),
];
