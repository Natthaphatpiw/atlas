import type { CatalogDevice, CatalogSpecOption, DeviceSpecKey } from "@/domain/device-catalog";
import type { Device } from "@/domain/types";

export function selectableDeviceSpecs(device: CatalogDevice | Device): [DeviceSpecKey, string][] {
  const order: DeviceSpecKey[] = ["chip", "ram", "storage", "network", "displaySize", "color"];
  return (Object.entries(device.specs).filter(([key, value]) =>
    Boolean(value) && (key !== "network" || ("specOptions" in device && Boolean(device.specOptions.network?.length))),
  ) as [DeviceSpecKey, string][]).sort(([left], [right]) => order.indexOf(left) - order.indexOf(right));
}

export function availableDeviceSpecOptions(device: CatalogDevice, key: DeviceSpecKey, prior: Record<string, string>): CatalogSpecOption[] {
  const fallback = device.specs[key];
  const options = device.specOptions[key] ?? (fallback ? [{ id: `fixed-${key}`, value: fallback, label: fallback }] : []);
  if (!device.configurations?.length) return options;
  return options.filter((option) => device.configurations?.some((configuration) =>
    (!configuration[key as keyof typeof configuration] || configuration[key as keyof typeof configuration]?.includes(option.value)) &&
    Object.entries(prior).every(([selectedKey, selectedValue]) => {
      const permitted = configuration[selectedKey as keyof typeof configuration];
      return !permitted || permitted.includes(selectedValue);
    }),
  ));
}

/** Resolve fixed values in spec order so each choice sees its valid upstream configuration. */
export function resolveDeviceSpecSelections(device: CatalogDevice, selections: Record<string, string>) {
  const valid: Record<string, string> = {};
  const choices: { key: DeviceSpecKey; options: CatalogSpecOption[] }[] = [];
  const invalidKeys: DeviceSpecKey[] = [];
  for (const [key] of selectableDeviceSpecs(device)) {
    const options = availableDeviceSpecOptions(device, key, valid);
    if (options.length === 0) {
      invalidKeys.push(key);
      break;
    }
    if (options.length === 1) {
      valid[key] = options[0].value;
    } else {
      choices.push({ key, options });
    }
    if (options.length > 1 && options.some((option) => option.value === selections[key])) {
      valid[key] = selections[key];
    }
  }
  return { selections: valid, choices, invalidKeys };
}

/** Keep earlier selections, clear invalid downstream values, and fill single-option dimensions. */
export function reconcileDeviceSpecSelections(device: CatalogDevice, selections: Record<string, string>) {
  return resolveDeviceSpecSelections(device, selections).selections;
}

export function selectedDeviceSnapshot(device: Device, selections: Record<string, string>) {
  return {
    ...device,
    // Keep a stable catalog default for non-interactive connectivity so legacy session snapshots still match.
    specs: { ...device.specs, ...selections },
  };
}
