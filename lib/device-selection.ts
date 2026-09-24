import type { Device } from "@/domain/types";

export function selectableDeviceSpecs(device: Device) {
  return Object.entries(device.specs).filter(([key, value]) => key !== "network" && Boolean(value));
}

export function selectedDeviceSnapshot(device: Device, selections: Record<string, string>) {
  return {
    ...device,
    // Keep a stable catalog default for non-interactive connectivity so legacy session snapshots still match.
    specs: { ...device.specs, ...selections },
  };
}
