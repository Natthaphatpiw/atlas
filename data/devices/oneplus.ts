import { official, phone } from "./helpers";

const onePlus = (id: string, model: string, releaseYear: number, storage: string[], url: string) =>
  phone({ id, brandId: "oneplus", brand: "OnePlus", model, releaseYear, sortOrder: 10, storage, sources: [official(url, "regional")], regional: true });

export const onePlusPhones = [
  onePlus("device-oneplus-13", "OnePlus 13", 2024, ["256GB", "512GB"], "https://www.oneplus.com/us/13/specs"),
  onePlus("device-oneplus-12", "OnePlus 12", 2023, ["256GB", "512GB"], "https://www.oneplus.com/by/12/specs"),
  onePlus("device-oneplus-10-pro", "OnePlus 10 Pro", 2022, ["128GB", "256GB"], "https://www.oneplus.com/us/10-pro/specs"),
  onePlus("device-oneplus-9-pro", "OnePlus 9 Pro", 2021, ["128GB", "256GB"], "https://www.oneplus.com/es/9-pro/specs"),
  onePlus("device-oneplus-8t", "OnePlus 8T", 2020, ["128GB", "256GB"], "https://www.oneplus.com/us/8t/specs"),
];
