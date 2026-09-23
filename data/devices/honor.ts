import { official, phone } from "./helpers";

const honor = (id: string, model: string, releaseYear: number, sortOrder: number, storage: string[], url: string) =>
  phone({ id, brandId: "honor", brand: "HONOR", model, releaseYear, sortOrder, storage, sources: [official(url, "regional")], regional: true });

export const honorPhones = [
  honor("device-honor-magic7-pro", "Magic7 Pro", 2024, 10, ["512GB"], "https://www.honor.com/uk/phones/honor-magic7-pro/spec/"),
  honor("device-honor-magic6-pro", "Magic6 Pro", 2024, 20, ["512GB"], "https://www.honor.com/uk/phones/honor-magic6-pro/spec/"),
  honor("device-honor-magic5-pro", "Magic5 Pro", 2023, 10, ["512GB"], "https://www.honor.com/latam/phones/honor-magic5-pro/spec/"),
  honor("device-honor-magic-v2", "Magic V2", 2023, 20, ["256GB", "512GB"], "https://www.honor.com/ae-en/shop/buying-guide/introducing-honor-magic-v2/"),
  honor("device-honor-magic4-pro", "Magic4 Pro", 2022, 10, ["256GB"], "https://www.honor.com/in/news/honor-magic4-pro-launch-uk/"),
];
