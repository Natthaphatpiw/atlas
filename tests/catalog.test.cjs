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

const { catalogBrands, compareCatalogDevices, deviceCatalog, phoneCatalog } = require("../data/devices/index.ts");
const { getMockAssessment } = require("../adapters/mock/assessment.ts");
const { MockValuationService } = require("../adapters/mock/valuation.ts");
const session = require("../lib/valuation-session.ts");

test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
});

test("catalog IDs, brands, configurations, and sources are internally consistent", () => {
  assert.equal(deviceCatalog.length, 82);
  assert.equal(phoneCatalog.length, 81);
  assert.equal(new Set(deviceCatalog.map((device) => device.id)).size, deviceCatalog.length);
  assert.equal(new Set(catalogBrands.map((brand) => brand.id)).size, catalogBrands.length);
  const brands = new Map(catalogBrands.map((brand) => [brand.id, brand.label]));
  const configurations = new Set();

  for (const device of deviceCatalog) {
    assert.equal(brands.get(device.brandId), device.brand, `${device.id} uses a declared brand`);
    assert.ok(["phone", "tablet", "laptop", "watch", "audio", "other"].includes(device.category));
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
