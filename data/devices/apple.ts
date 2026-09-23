import { official, phone } from "./helpers";

const identify = official("https://support.apple.com/en-gb/108044", "global");
const apple17 = official("https://www.apple.com/th/iphone-17e/specs/");

const iphone = (id: string, model: string, releaseYear: number, sortOrder: number, storage: string[], colors: string[], source = identify, defaults: { storage?: string; color?: string } = {}) =>
  phone({ id, brandId: "apple", brand: "Apple", model, releaseYear, sortOrder, storage, colors, sources: [source], defaultStorage: defaults.storage, defaultColor: defaults.color });

export const applePhones = [
  iphone("device-iphone-17e", "iPhone 17e", 2026, 10, ["256GB", "512GB"], ["Black", "White", "Soft Pink"], apple17),
  iphone("device-iphone-17", "iPhone 17", 2025, 10, ["256GB", "512GB"], ["Black", "White", "Mist Blue", "Sage", "Lavender"]),
  iphone("device-iphone-air", "iPhone Air", 2025, 20, ["256GB", "512GB", "1TB"], ["Space Black", "Cloud White", "Light Gold", "Sky Blue"]),
  iphone("device-iphone-17-pro", "iPhone 17 Pro", 2025, 30, ["256GB", "512GB", "1TB"], ["Silver", "Cosmic Orange", "Deep Blue"]),
  iphone("device-iphone-17-pro-max", "iPhone 17 Pro Max", 2025, 40, ["256GB", "512GB", "1TB", "2TB"], ["Silver", "Cosmic Orange", "Deep Blue"]),
  iphone("device-iphone-16e", "iPhone 16e", 2025, 50, ["128GB", "256GB", "512GB"], ["Black", "White"], official("https://www.apple.com/th/newsroom/2025/02/apple-debuts-iphone-16e-a-powerful-new-member-of-the-iphone-16-family/")),
  iphone("device-iphone-16", "iPhone 16", 2024, 10, ["128GB", "256GB", "512GB"], ["Black", "White", "Pink", "Teal", "Ultramarine"]),
  iphone("device-iphone-16-plus", "iPhone 16 Plus", 2024, 20, ["128GB", "256GB", "512GB"], ["Black", "White", "Pink", "Teal", "Ultramarine"]),
  iphone("device-iphone-16-pro", "iPhone 16 Pro", 2024, 30, ["128GB", "256GB", "512GB", "1TB"], ["Black Titanium", "White Titanium", "Natural Titanium", "Desert Titanium"]),
  iphone("device-iphone-16-pro-max", "iPhone 16 Pro Max", 2024, 40, ["256GB", "512GB", "1TB"], ["Black Titanium", "White Titanium", "Natural Titanium", "Desert Titanium"]),
  iphone("device-iphone-15", "iPhone 15", 2023, 10, ["128GB", "256GB", "512GB"], ["Black", "Blue", "Green", "Yellow", "Pink"]),
  iphone("device-iphone-15-plus", "iPhone 15 Plus", 2023, 20, ["128GB", "256GB", "512GB"], ["Black", "Blue", "Green", "Yellow", "Pink"]),
  iphone("device-iphone-15-pro", "iPhone 15 Pro", 2023, 30, ["128GB", "256GB", "512GB", "1TB"], ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"], identify, { storage: "256GB", color: "Natural Titanium" }),
  iphone("device-iphone-15-pro-max", "iPhone 15 Pro Max", 2023, 40, ["256GB", "512GB", "1TB"], ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"]),
  iphone("device-iphone-14", "iPhone 14", 2022, 10, ["128GB", "256GB", "512GB"], ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"]),
  iphone("device-iphone-14-plus", "iPhone 14 Plus", 2022, 20, ["128GB", "256GB", "512GB"], ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"]),
  iphone("device-iphone-14-pro", "iPhone 14 Pro", 2022, 30, ["128GB", "256GB", "512GB", "1TB"], ["Silver", "Gold", "Space Black", "Deep Purple"]),
  iphone("device-iphone-14-pro-max", "iPhone 14 Pro Max", 2022, 40, ["128GB", "256GB", "512GB", "1TB"], ["Silver", "Gold", "Space Black", "Deep Purple"]),
  iphone("device-iphone-13", "iPhone 13", 2021, 10, ["128GB", "256GB", "512GB"], ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"]),
  iphone("device-iphone-13-mini", "iPhone 13 mini", 2021, 20, ["128GB", "256GB", "512GB"], ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"]),
  iphone("device-iphone-13-pro", "iPhone 13 Pro", 2021, 30, ["128GB", "256GB", "512GB", "1TB"], ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"]),
  iphone("device-iphone-13-pro-max", "iPhone 13 Pro Max", 2021, 40, ["128GB", "256GB", "512GB", "1TB"], ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"]),
  iphone("device-iphone-12", "iPhone 12", 2020, 10, ["64GB", "128GB", "256GB"], ["Black", "White", "(PRODUCT)RED", "Green", "Blue", "Purple"], official("https://support.apple.com/en-my/111876", "regional")),
  iphone("device-iphone-12-mini", "iPhone 12 mini", 2020, 20, ["64GB", "128GB", "256GB"], ["Black", "White", "(PRODUCT)RED", "Green", "Blue", "Purple"]),
  iphone("device-iphone-12-pro", "iPhone 12 Pro", 2020, 30, ["128GB", "256GB", "512GB"], ["Silver", "Graphite", "Gold", "Pacific Blue"], official("https://support.apple.com/en-gb/111875", "regional")),
  iphone("device-iphone-12-pro-max", "iPhone 12 Pro Max", 2020, 40, ["128GB", "256GB", "512GB"], ["Silver", "Graphite", "Gold", "Pacific Blue"]),
];

export const detailedIPhoneIds = new Set(applePhones.map((device) => device.id));
