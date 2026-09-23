import { official, phone } from "./helpers";

const sony = (id: string, model: string, releaseYear: number, storage: string[], url: string) =>
  phone({ id, brandId: "sony", brand: "Sony", model, releaseYear, sortOrder: 10, storage, sources: [official(url, "regional")], regional: true });

export const sonyPhones = [
  sony("device-sony-xperia-1-v", "Xperia 1 V", 2023, ["256GB"], "https://www.sony.com/electronics/support/mobile-phones-tablets-mobile-phones/xperia-1-v-256gb/specifications"),
  sony("device-sony-xperia-1-iii", "Xperia 1 III", 2021, ["256GB"], "https://www.sony.com/electronics/support/mobile-phones-tablets-mobile-phones/xperia-1-iii/specifications"),
  sony("device-sony-xperia-1-ii", "Xperia 1 II", 2020, ["256GB"], "https://www.sony.com/electronics/support/mobile-phones-tablets-mobile-phones/xperia-1-ii/specifications"),
];
