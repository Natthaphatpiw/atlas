import { official, phone } from "./helpers";

const realme = (id: string, model: string, releaseYear: number, sortOrder: number, storage: string[], url: string) =>
  phone({ id, brandId: "realme", brand: "realme", model, releaseYear, sortOrder, storage, sources: [official(url, "regional")], regional: true });

export const realmePhones = [
  realme("device-realme-gt-7-pro", "GT 7 Pro", 2024, 10, ["256GB", "512GB"], "https://www.realme.com/in/realme-gt-7-pro/specs"),
  realme("device-realme-gt-6", "GT 6", 2024, 20, ["256GB", "512GB"], "https://www.realme.com/sg/realme-gt-6/specs"),
  realme("device-realme-12-pro-plus-5g", "12 Pro+ 5G", 2024, 30, ["128GB", "256GB"], "https://www.realme.com/in/realme-12-pro-plus/specs"),
  realme("device-realme-gt-2-pro", "GT 2 Pro", 2022, 10, ["128GB", "256GB"], "https://www.realme.com/in/realme-gt-2-pro/specs"),
  realme("device-realme-10-pro-plus-5g", "10 Pro+ 5G", 2022, 20, ["128GB", "256GB"], "https://www.realme.com/global/realme-10-pro-plus/specs"),
];
