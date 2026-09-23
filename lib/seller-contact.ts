import type { SellerContact } from "@/domain/valuation-request";

export function normalizeSellerContact(contact: SellerContact): SellerContact {
  const lineIdProvided = contact.lineIdProvided?.trim();
  return {
    fullName: contact.fullName.trim(),
    phone: contact.phone.trim().replace(/[\s-]/g, ""),
    consentToContact: contact.consentToContact,
    ...(lineIdProvided ? { lineIdProvided } : {}),
  };
}

export function contactErrors(contact: SellerContact) {
  const normalized = normalizeSellerContact(contact);
  return {
    name: normalized.fullName ? "" : "กรุณาระบุชื่อ",
    phone: !normalized.phone ? "กรุณาระบุเบอร์โทรศัพท์" : /^0\d{9}$/.test(normalized.phone) ? "" : "กรุณาตรวจสอบเบอร์โทรศัพท์อีกครั้ง",
    consent: normalized.consentToContact === true ? "" : "กรุณายินยอมให้ติดต่อกลับก่อนดำเนินการต่อ",
  };
}
