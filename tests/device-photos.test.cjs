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
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const photos = require("../lib/device-photos.ts");
const session = require("../lib/valuation-session.ts");

test.after(() => {
  Module._resolveFilename = originalResolve;
  require.extensions[".ts"] = originalTsLoader;
});

const photo = (name, type = "image/jpeg", size = 1024) => ({ name, type, size });

test("allows zero through five supported photos and rejects a sixth", () => {
  assert.deepEqual(photos.selectDevicePhotos(0, []), { accepted: [], errors: [] });
  for (let count = 1; count <= 5; count += 1) {
    const result = photos.selectDevicePhotos(0, Array.from({ length: count }, (_, index) => photo(`device-${index}.jpg`)));
    assert.equal(result.accepted.length, count);
    assert.deepEqual(result.errors, []);
  }
  const full = photos.selectDevicePhotos(5, [photo("sixth.jpg")]);
  assert.deepEqual(full.accepted, []);
  assert.deepEqual(full.errors, [{ fileName: "sixth.jpg", reason: "limit_reached" }]);
});

test("rejects unsupported and oversized files while keeping valid files in selection order", () => {
  const result = photos.selectDevicePhotos(3, [
    photo("first.png", "image/png"),
    photo("large.webp", "image/webp", photos.MAX_DEVICE_PHOTO_BYTES + 1),
    photo("notes.txt", "text/plain"),
    photo("second.webp", "image/webp"),
    photo("sixth.jpg"),
  ]);
  assert.deepEqual(result.accepted.map((file) => file.name), ["first.png", "second.webp"]);
  assert.deepEqual(result.errors, [
    { fileName: "large.webp", reason: "too_large" },
    { fileName: "notes.txt", reason: "unsupported_type" },
    { fileName: "sixth.jpg", reason: "limit_reached" },
  ]);
});

test("removing a photo frees a slot", () => {
  const current = [
    { id: "one", ...photo("one.jpg") },
    { id: "two", ...photo("two.jpg") },
    { id: "three", ...photo("three.jpg") },
    { id: "four", ...photo("four.jpg") },
    { id: "five", ...photo("five.jpg") },
  ];
  const remaining = photos.removeDevicePhoto(current, "three");
  assert.equal(remaining.length, 4);
  assert.deepEqual(photos.selectDevicePhotos(remaining.length, [photo("replacement.jpg")]).accepted.map((file) => file.name), ["replacement.jpg"]);
});

test("photo selection neither changes nor serializes the valuation session", () => {
  const device = {
    id: "device-iphone-15-pro", category: "phone", brand: "Apple", model: "iPhone 15 Pro",
    specs: { storage: "256GB", color: "Natural Titanium", network: "5G" }, createdAt: "old",
  };
  const stored = {
    device,
    session: {
      id: "photo-independent-session", deviceId: device.id, status: "estimated", conditionAnswers: [],
      expectedPrice: { amount: 22000, currency: "THB", enteredBy: "seller", source: "manual_entry", createdAt: "old" },
      estimatedPrice: { amount: 21000 }, createdAt: "old", updatedAt: "old",
    },
  };
  const entries = new Map([["atlast.valuation.session", JSON.stringify(stored)]]);
  global.window = { sessionStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) } };

  const selected = photos.selectDevicePhotos(0, [photo("photo-that-must-not-persist.jpg")]);
  assert.equal(selected.accepted.length, 1);
  const unchanged = session.continueWithDevice(device);
  assert.equal(unchanged.session.id, "photo-independent-session");
  assert.equal(unchanged.session.status, "estimated");
  assert.doesNotMatch(global.window.sessionStorage.getItem("atlast.valuation.session"), /photo-that-must-not-persist|devicePhotos|previewUrl/);
});
