import type { SellerContact } from "@/domain/valuation-request";

export const ADDRESS_MIN_LENGTH = 10;
export const ADDRESS_MAX_LENGTH = 300;
/** Thai postcodes run from 10000 (Bangkok) to 96xxx (Narathiwat). */
export const THAI_POSTCODE = /^(1\d|[2-8]\d|9[0-6])\d{3}$/;

export function normalizeSellerContact(contact: SellerContact): SellerContact {
  const lineIdProvided = contact.lineIdProvided?.trim();
  const address = contact.address
    ? { line: contact.address.line.replace(/\s+/g, " ").trim(), postcode: contact.address.postcode.replace(/\D/g, "") }
    : undefined;
  return {
    fullName: contact.fullName.trim(),
    phone: contact.phone.trim().replace(/[\s-]/g, ""),
    consentToContact: contact.consentToContact,
    ...(lineIdProvided ? { lineIdProvided } : {}),
    ...(address ? { address } : {}),
  };
}

/** Field errors in Thai; empty strings mean valid. The address is checked only when it is required (ขายฝาก). */
export function contactErrors(contact: SellerContact, options: { requireAddress?: boolean } = {}) {
  const normalized = normalizeSellerContact(contact);
  const line = normalized.address?.line ?? "";
  const postcode = normalized.address?.postcode ?? "";
  return {
    name: normalized.fullName ? "" : "กรุณาระบุชื่อ",
    phone: !normalized.phone ? "กรุณาระบุเบอร์โทรศัพท์" : /^0\d{9}$/.test(normalized.phone) ? "" : "กรุณาตรวจสอบเบอร์โทรศัพท์อีกครั้ง",
    address: !options.requireAddress ? ""
      : !line ? "กรุณาระบุที่อยู่"
        : line.length < ADDRESS_MIN_LENGTH ? "กรุณาระบุที่อยู่ให้ครบ เช่น บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
          : line.length > ADDRESS_MAX_LENGTH ? `ที่อยู่ยาวเกิน ${ADDRESS_MAX_LENGTH} ตัวอักษร` : "",
    postcode: !options.requireAddress ? ""
      : !postcode ? "กรุณาระบุรหัสไปรษณีย์"
        : THAI_POSTCODE.test(postcode) ? "" : "กรุณาตรวจสอบรหัสไปรษณีย์ (ตัวเลข 5 หลัก)",
    consent: normalized.consentToContact === true ? "" : "กรุณายินยอมให้ติดต่อกลับก่อนดำเนินการต่อ",
  };
}

/** True when the seller chose ขายฝาก and so must give an address. */
export const requiresAddress = (transactionIntent: string | undefined) => transactionIntent === "sell_and_repurchase";
