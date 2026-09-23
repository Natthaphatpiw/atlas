import { official, phone } from "./helpers";

const vivo = (id: string, model: string, releaseYear: number, sortOrder: number, storage: string[], slug: string) =>
  phone({ id, brandId: "vivo", brand: "vivo", model, releaseYear, sortOrder, storage, sources: [official(`https://www.vivo.com/th/products/param/${slug}`)] });

export const vivoPhones = [
  vivo("device-vivo-v70", "V70", 2026, 10, ["256GB", "512GB"], "v70"),
  vivo("device-vivo-v50", "V50", 2025, 10, ["256GB", "512GB"], "v50"),
  vivo("device-vivo-v30", "V30", 2024, 10, ["256GB", "512GB"], "v30"),
  vivo("device-vivo-v40", "V40", 2024, 20, ["512GB"], "v40"),
  vivo("device-vivo-y200", "Y200", 2024, 30, ["256GB", "512GB"], "y200"),
  vivo("device-vivo-x100", "X100", 2024, 40, ["256GB", "512GB"], "x100"),
];
