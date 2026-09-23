import { official, phone } from "./helpers";

const huawei = (id: string, model: string, releaseYear: number, storage: string[], url: string) =>
  phone({ id, brandId: "huawei", brand: "Huawei", model, releaseYear, sortOrder: 10, storage, sources: [official(url, "regional")], regional: true });

export const huaweiPhones = [
  huawei("device-huawei-pura-70-ultra", "Pura 70 Ultra", 2024, ["512GB"], "https://consumer.huawei.com/sg/phones/pura70-ultra/specs/"),
  huawei("device-huawei-mate-50-pro", "Mate 50 Pro", 2022, ["256GB", "512GB"], "https://consumer.huawei.com/ae-en/phones/mate50-pro/specs/"),
  huawei("device-huawei-p50-pro", "P50 Pro", 2021, ["256GB"], "https://consumer.huawei.com/latin/phones/p50-pro/specs/"),
  huawei("device-huawei-p40-pro", "P40 Pro", 2020, ["256GB"], "https://consumer.huawei.com/ke/phones/p40-pro/specs/"),
];
