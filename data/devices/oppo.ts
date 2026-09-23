import { official, phone } from "./helpers";

const oppo = (id: string, model: string, releaseYear: number, sortOrder: number, storage: string[], slug: string) =>
  phone({ id, brandId: "oppo", brand: "OPPO", model, releaseYear, sortOrder, storage, sources: [official(`https://www.oppo.com/th/smartphones/series-${slug}/specs/`)] });

export const oppoPhones = [
  oppo("device-oppo-reno13-f-5g", "Reno13 F 5G", 2025, 10, ["512GB"], "reno/reno13-f-5g"),
  oppo("device-oppo-find-x8", "Find X8", 2024, 10, ["256GB", "512GB"], "find-x/find-x8"),
  oppo("device-oppo-reno12-f-5g", "Reno12 F 5G", 2024, 20, ["256GB"], "reno/reno12-f-5g"),
  oppo("device-oppo-a60", "A60", 2024, 30, ["128GB", "256GB"], "a/a60"),
];
