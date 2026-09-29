/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
const originalTsLoader = require.extensions[".ts"];

Module._resolveFilename = function resolveAtlasAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) return originalResolve.call(this, path.join(root, request.slice(2)), parent, isMain, options);
  return originalResolve.call(this, request, parent, isMain, options);
};
require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { catalogBrands, compareCatalogDevices, deviceCatalog, phoneCatalog, tabletCatalog, macCatalog } = require("../data/devices/index.ts");
const { getMockAssessment } = require("../adapters/mock/assessment.ts");
const { MockValuationService } = require("../adapters/mock/valuation.ts");
const session = require("../lib/valuation-session.ts");
const selection = require("../lib/device-selection.ts");

test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
});

test("catalog IDs, brands, configurations, and sources are internally consistent", () => {
  assert.equal(deviceCatalog.length, 228);
  assert.equal(phoneCatalog.length, 81);
  assert.equal(new Set(deviceCatalog.map((device) => device.id)).size, deviceCatalog.length);
  assert.equal(new Set(catalogBrands.map((brand) => brand.id)).size, catalogBrands.length);
  const brands = new Map(catalogBrands.map((brand) => [brand.id, brand.label]));
  const configurations = new Set();

  for (const device of deviceCatalog) {
    assert.equal(brands.get(device.brandId), device.brand, `${device.id} uses a declared brand`);
    assert.ok(["phone", "tablet", "laptop", "desktop", "watch", "audio", "other"].includes(device.category));
    assert.ok(Number.isInteger(device.releaseYear) && device.releaseYear >= 2020 && device.releaseYear <= 2026);
    assert.ok(device.sources.length > 0 && device.sources.every((source) => source.url.startsWith("https://")));
    const signature = `${device.brandId}\u0000${device.model.toLowerCase()}`;
    assert.ok(!configurations.has(signature), `${device.id} has a unique model name within its brand`);
    configurations.add(signature);

    for (const [key, options] of Object.entries(device.specOptions)) {
      assert.ok(options.length > 0, `${device.id}.${key} has options`);
      assert.equal(new Set(options.map((option) => option.id)).size, options.length, `${device.id}.${key} option IDs are unique`);
      assert.ok(options.every((option) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(option.id)), `${device.id}.${key} option IDs are valid`);
      assert.ok(options.some((option) => option.value === device.specs[key]), `${device.id}.${key} includes its default`);
    }
    if (device.category === "phone") assert.ok(device.specOptions.storage?.length > 0, `${device.id} has storage choices`);
  }
});

test("tablet and Mac additions cover verified families without changing phone identities", () => {
  assert.equal(tabletCatalog.length, 86);
  assert.equal(macCatalog.length, 61);
  assert.equal(new Set(tabletCatalog.map((device) => device.brandId)).size, 9);
  assert.ok(tabletCatalog.every((device) => device.category === "tablet" && device.releaseYear >= 2020));
  assert.ok(macCatalog.every((device) => ["laptop", "desktop"].includes(device.category) && device.releaseYear >= 2020));
  assert.deepEqual([Math.min(...tabletCatalog.map((device) => device.releaseYear)), Math.max(...tabletCatalog.map((device) => device.releaseYear))], [2020, 2026]);
  assert.deepEqual([Math.min(...macCatalog.map((device) => device.releaseYear)), Math.max(...macCatalog.map((device) => device.releaseYear))], [2020, 2026]);
  for (const id of [
    "device-ipad-8th", "device-ipad-mini-6th", "device-ipad-air-m4-11", "device-ipad-pro-m5-13",
    "device-galaxy-tab-s7", "device-galaxy-tab-s11", "device-galaxy-tab-a11",
    "device-xiaomi-pad-8", "device-huawei-matepad-pro-12-2-2025", "device-honor-pad-10",
    "device-oppo-pad-3-matte", "device-oneplus-pad-3", "device-pixel-tablet", "device-realme-pad",
  ]) assert.ok(tabletCatalog.some((device) => device.id === id), `${id} is present`);
  for (const family of ["MacBook Air", "MacBook Pro", "iMac", "Mac mini", "Mac Studio", "Mac Pro"]) {
    assert.ok(deviceCatalog.some((device) => device.brandId === "apple" && device.model.startsWith(family)), `${family} is available`);
  }
  assert.equal(phoneCatalog.length, 81);
});

test("phone coverage and ordering are deterministic across 2020 through 2026", () => {
  const counts = Object.fromEntries(catalogBrands.map(({ id }) => [id, phoneCatalog.filter((device) => device.brandId === id).length]));
  assert.deepEqual(counts, {
    apple: 26, google: 5, honor: 5, huawei: 4, oneplus: 5, oppo: 4,
    realme: 5, samsung: 10, sony: 3, vivo: 6, xiaomi: 8,
  });
  assert.deepEqual([...new Set(phoneCatalog.map((device) => device.releaseYear))].sort(), [2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.deepEqual(phoneCatalog, [...phoneCatalog].sort(compareCatalogDevices));
  for (const brand of catalogBrands) {
    const devices = phoneCatalog.filter((device) => device.brandId === brand.id);
    assert.deepEqual(devices, [...devices].sort(compareCatalogDevices), `${brand.label} is newest first`);
  }
});

test("existing catalog identities and defaults remain compatible", () => {
  const iphone = deviceCatalog.find((device) => device.id === "device-iphone-15-pro");
  assert.deepEqual(
    { category: iphone.category, brand: iphone.brand, model: iphone.model, specs: iphone.specs },
    { category: "phone", brand: "Apple", model: "iPhone 15 Pro", specs: { storage: "256GB", color: "Natural Titanium", network: "5G" } },
  );
  const samsung = deviceCatalog.find((device) => device.id === "device-samsung-s24-ultra");
  assert.deepEqual(
    { category: samsung.category, brand: samsung.brand, model: samsung.model, specs: samsung.specs },
    { category: "phone", brand: "Samsung", model: "Galaxy S24 Ultra", specs: { storage: "512GB", color: "Titanium Gray", network: "5G" } },
  );
  assert.equal(samsung.variant, "512GB");
});

test("connectivity stays in the persisted snapshot without becoming a selectable spec", () => {
  const iphone = deviceCatalog.find((device) => device.id === "device-iphone-15-pro");
  assert.deepEqual(selection.selectableDeviceSpecs(iphone).map(([key]) => key), ["storage", "color"]);
  const snapshot = selection.selectedDeviceSnapshot(iphone, { storage: "512GB", color: "Black Titanium" });
  assert.equal(snapshot.specs.network, "5G");
  assert.equal(snapshot.specs.storage, "512GB");
});

const configured = {
    id: "configuration-fixture", category: "tablet", brand: "Example", model: "Example Pad", createdAt: "now",
    brandId: "example", releaseYear: 2024, sortOrder: 1, sources: [{ url: "https://example.com", region: "global" }],
    specs: { chip: "A", ram: "8GB", storage: "128GB", network: "Wi-Fi" },
    specOptions: {
      chip: [{ id: "a", value: "A", label: "A" }, { id: "b", value: "B", label: "B" }],
      ram: [{ id: "8gb", value: "8GB", label: "8GB" }, { id: "16gb", value: "16GB", label: "16GB" }],
      storage: [{ id: "128gb", value: "128GB", label: "128GB" }, { id: "512gb", value: "512GB", label: "512GB" }],
      network: [{ id: "wi-fi", value: "Wi-Fi", label: "Wi-Fi" }, { id: "cellular", value: "Wi-Fi + Cellular", label: "Wi-Fi + Cellular" }],
    },
    configurations: [
      { chip: ["A"], ram: ["8GB"], storage: ["128GB"], network: ["Wi-Fi"] },
      { chip: ["B"], ram: ["16GB"], storage: ["512GB"], network: ["Wi-Fi", "Wi-Fi + Cellular"] },
    ],
};

test("configuration choices filter dependent RAM, storage, and cellular variants", () => {
  const values = (key, prior) => selection.availableDeviceSpecOptions(configured, key, prior).map((option) => option.value);
  assert.deepEqual(selection.selectableDeviceSpecs(configured).map(([key]) => key), ["chip", "ram", "storage", "network"]);
  assert.deepEqual(values("ram", { chip: "A" }), ["8GB"]);
  assert.deepEqual(values("storage", { chip: "B", ram: "16GB" }), ["512GB"]);
  assert.deepEqual(values("network", { chip: "A", ram: "8GB", storage: "128GB" }), ["Wi-Fi"]);
  assert.deepEqual(values("network", { chip: "B", ram: "16GB", storage: "512GB" }), ["Wi-Fi", "Wi-Fi + Cellular"]);
  assert.deepEqual(selection.reconcileDeviceSpecSelections(configured, { chip: "B", ram: "8GB", storage: "128GB", network: "Wi-Fi + Cellular" }),
    { chip: "B", ram: "16GB", storage: "512GB", network: "Wi-Fi + Cellular" });
  assert.equal(selection.selectedDeviceSnapshot(configured, { chip: "B", ram: "16GB", storage: "512GB", network: "Wi-Fi + Cellular" }).specs.network, "Wi-Fi + Cellular");
});

test("single options resolve while genuine choices still need a selection", () => {
  const single = { ...configured, specOptions: { ...configured.specOptions, chip: [configured.specOptions.chip[0]] } };
  const resolved = selection.resolveDeviceSpecSelections(single, {});
  assert.equal(resolved.selections.chip, "A");
  assert.equal(resolved.selections.ram, "8GB");
  assert.equal(resolved.selections.storage, "128GB");
  assert.equal(resolved.selections.network, "Wi-Fi");
  assert.deepEqual(resolved.choices, []);
  assert.deepEqual(resolved.invalidKeys, []);

  const undecided = selection.resolveDeviceSpecSelections(configured, {});
  assert.equal(undecided.selections.chip, undefined);
  assert.ok(undecided.choices.some(({ key, options }) => key === "chip" && options.length === 2));
});

test("dependency changes clear incompatible choices and cascade fixed values", () => {
  const fromA = selection.resolveDeviceSpecSelections(configured, { chip: "A", network: "Wi-Fi" });
  assert.deepEqual(fromA.selections, { chip: "A", ram: "8GB", storage: "128GB", network: "Wi-Fi" });
  assert.ok(fromA.choices.every(({ key }) => Boolean(fromA.selections[key])));

  const toB = selection.resolveDeviceSpecSelections(configured, { ...fromA.selections, chip: "B" });
  assert.deepEqual(toB.selections, { chip: "B", ram: "16GB", storage: "512GB", network: "Wi-Fi" });
  assert.deepEqual(toB.choices.map(({ key }) => key), ["chip", "network"]);

  const backToA = selection.resolveDeviceSpecSelections(configured, { ...toB.selections, chip: "A", network: "Wi-Fi + Cellular" });
  assert.deepEqual(backToA.selections, fromA.selections);
});

test("model-inherent Mac and iPad values stay resolved in the saved device", () => {
  for (const [id, fixed, visible] of [
    ["device-mac-mini-m2", { chip: "M2" }, ["ram", "storage"]],
    ["device-mac-mini-m2-pro", { chip: "M2 Pro" }, ["ram", "storage"]],
    ["device-macbook-pro-m3-pro-14", { displaySize: "14.2-inch" }, ["chip", "ram", "storage"]],
    ["device-ipad-pro-12-9-6th", { displaySize: "12.9-inch" }, ["storage", "network"]],
  ]) {
    const device = deviceCatalog.find((item) => item.id === id);
    const resolved = selection.resolveDeviceSpecSelections(device, {});
    assert.deepEqual(resolved.invalidKeys, [], id);
    for (const [key, value] of Object.entries(fixed)) assert.equal(resolved.selections[key], value, `${id}.${key}`);
    for (const key of Object.keys(fixed)) assert.ok(!resolved.choices.some((choice) => choice.key === key), `${id}.${key} is hidden`);
    assert.deepEqual(resolved.choices.map(({ key }) => key), visible, id);
  }

  const mini = deviceCatalog.find((item) => item.id === "device-mac-mini-m2");
  const choices = selection.resolveDeviceSpecSelections(mini, { ram: "16GB", storage: "512GB" });
  const snapshot = selection.selectedDeviceSnapshot(mini, choices.selections);
  const previousWindow = global.window;
  const entries = new Map();
  global.window = { sessionStorage: {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  } };
  try {
    session.continueWithDevice(snapshot);
    assert.equal(session.readValuationSession().device.specs.chip, "M2");
    assert.equal(session.readValuationSession().device.specs.ram, "16GB");
  } finally {
    global.window = previousWindow;
  }
});

test("a dimension with zero valid options is reported as catalog data error", () => {
  const broken = { ...configured, specOptions: { ...configured.specOptions, chip: [] } };
  const resolved = selection.resolveDeviceSpecSelections(broken, {});
  assert.deepEqual(resolved.invalidKeys, ["chip"]);
  assert.deepEqual(resolved.selections, {});
});

test("catalog configuration rows refer only to real offered options and defaults", () => {
  for (const device of deviceCatalog) {
    assert.deepEqual(selection.resolveDeviceSpecSelections(device, {}).invalidKeys, [], `${device.id} has valid starting choices`);
  }
  for (const device of [...tabletCatalog, ...macCatalog]) {
    if (!device.configurations?.length) continue;
    const keys = Object.keys(device.configurations[0]);
    assert.ok(keys.length > 0, `${device.id} has constrained dimensions`);
    for (const configuration of device.configurations) {
      for (const [key, values] of Object.entries(configuration)) {
        assert.ok(values.length > 0, `${device.id}.${key} has a nonempty configuration`);
        assert.ok(values.every((value) => device.specOptions[key]?.some((option) => option.value === value)), `${device.id}.${key} uses offered values`);
      }
    }
    for (const [key, offered] of Object.entries(device.specOptions)) {
      if (!device.configurations.some((configuration) => configuration[key])) continue;
      assert.ok(offered.every((option) => device.configurations.some((configuration) =>
        !configuration[key] || configuration[key].includes(option.value))), `${device.id}.${key} has no unreachable choices`);
    }
    assert.deepEqual(selection.reconcileDeviceSpecSelections(device, Object.fromEntries(selection.selectableDeviceSpecs(device).map(([key]) => [key, device.specs[key]]))),
      Object.fromEntries(selection.selectableDeviceSpecs(device).map(([key]) => [key, device.specs[key]])), `${device.id} default is selectable`);
  }
});

test("tablet capabilities survive selection and a changed variant invalidates old progress", () => {
  const ipad = tabletCatalog.find((device) => device.id === "device-ipad-air-m3-11");
  const selected = selection.selectedDeviceSnapshot(ipad, { storage: "256GB", network: "Wi-Fi + Cellular", displaySize: "11-inch" });
  assert.equal(selected.capabilities.stylus, true);
  assert.equal(selected.specs.network, "Wi-Fi + Cellular");
  assert.equal(getMockAssessment(selected).features.includes("cellular"), true);
  assert.equal(getMockAssessment(selected).features.includes("stylus"), true);
  assert.equal(session.hasSameDeviceConfiguration(selected, { ...selected, specs: { ...selected.specs, network: "Wi-Fi" } }), false);
  assert.equal(session.hasSameDeviceConfiguration(selected, { ...selected, capabilities: undefined }), false);
});

test("assessment coverage and service catalog boundary match the expanded catalog", async () => {
  for (const device of phoneCatalog) {
    assert.equal(getMockAssessment(device).coverage, device.brandId === "apple" ? "iphone" : "basic", device.id);
  }
  const serviceCatalog = await new MockValuationService().getDeviceCatalog();
  assert.deepEqual(serviceCatalog.map((device) => device.id), deviceCatalog.map((device) => device.id));
});

test("legacy device snapshots preserve progress only for the same model and configuration", () => {
  const catalogIphone = deviceCatalog.find((device) => device.id === "device-iphone-15-pro");
  const { brandId, releaseYear, sortOrder, sources, specOptions, ...iphone } = catalogIphone;
  void brandId; void releaseYear; void sortOrder; void sources; void specOptions;
  const stored = {
    device: iphone,
    session: {
      id: "existing-v2-session", deviceId: iphone.id, status: "estimated", conditionAnswers: [],
      expectedPrice: { amount: 22000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "old" },
      estimatedPrice: { amount: 21000 }, createdAt: "old", updatedAt: "old",
    },
  };
  const memoryWindow = (value) => {
    const entries = new Map([["atlast.valuation.session", JSON.stringify(value)]]);
    return { sessionStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, next) => entries.set(key, next), removeItem: (key) => entries.delete(key) } };
  };

  global.window = memoryWindow(stored);
  assert.equal(session.continueWithDevice(iphone).session.id, "existing-v2-session");
  assert.equal(session.readValuationSession().session.status, "estimated");

  global.window = memoryWindow(stored);
  const changedConfiguration = session.continueWithDevice({ ...iphone, specs: { ...iphone.specs, storage: "512GB" } });
  assert.notEqual(changedConfiguration.session.id, "existing-v2-session");
  assert.equal(changedConfiguration.session.status, "device_selected");
  assert.equal(changedConfiguration.session.expectedPrice, undefined);

  global.window = memoryWindow(stored);
  const changedModel = session.continueWithDevice({ ...iphone, id: "device-iphone-15-pro-max", model: "iPhone 15 Pro Max" });
  assert.notEqual(changedModel.session.id, "existing-v2-session");
  assert.equal(changedModel.session.status, "device_selected");
});
