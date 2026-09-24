export const MAX_DEVICE_PHOTOS = 5;
export const MAX_DEVICE_PHOTO_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_DEVICE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface DevicePhotoFile {
  name: string;
  size: number;
  type: string;
}

export interface DevicePhotoSelectionError {
  fileName: string;
  reason: "unsupported_type" | "too_large" | "limit_reached";
}

export interface DevicePhotoSelectionResult<T extends DevicePhotoFile> {
  accepted: T[];
  errors: DevicePhotoSelectionError[];
}

/**
 * Validates a browser selection without retaining File data. The caller owns
 * any preview URLs and must revoke them when the corresponding File is gone.
 */
export function selectDevicePhotos<T extends DevicePhotoFile>(
  activeCount: number,
  files: Iterable<T>,
): DevicePhotoSelectionResult<T> {
  const accepted: T[] = [];
  const errors: DevicePhotoSelectionError[] = [];

  for (const file of files) {
    if (!ACCEPTED_DEVICE_PHOTO_TYPES.has(file.type)) {
      errors.push({ fileName: file.name, reason: "unsupported_type" });
    } else if (file.size > MAX_DEVICE_PHOTO_BYTES) {
      errors.push({ fileName: file.name, reason: "too_large" });
    } else if (activeCount + accepted.length >= MAX_DEVICE_PHOTOS) {
      errors.push({ fileName: file.name, reason: "limit_reached" });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, errors };
}

export function removeDevicePhoto<T extends { id: string }>(photos: T[], id: string) {
  return photos.filter((photo) => photo.id !== id);
}

export function devicePhotoErrorMessage(error: DevicePhotoSelectionError) {
  if (error.reason === "too_large") return `“${error.fileName}” มีขนาดเกิน 10 MB`;
  if (error.reason === "unsupported_type") return `“${error.fileName}” รองรับเฉพาะ JPG, PNG หรือ WebP`;
  return `เพิ่ม “${error.fileName}” ไม่ได้: เลือกได้สูงสุด ${MAX_DEVICE_PHOTOS} รูป`;
}
