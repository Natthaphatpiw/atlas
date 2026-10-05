// Server-only LINE Messaging API calls for the Atlas LINE Official Account.
// LINE_MESSAGING_CHANNEL_ACCESS_TOKEN must never reach the browser.
import type { TransactionIntent } from "@/domain/types";

const API = "https://api.line.me/v2/bot";
const TIMEOUT_MS = 8_000;

const accessToken = () => process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim() || null;

/**
 * Whether the user has the Atlas OA as a friend. LINE returns a user's profile
 * only to an OA they have added (and not blocked), so 404 means "not a friend".
 * Null when it cannot be told: no token, or LINE unavailable.
 */
export async function getFriendStatus(userId: string): Promise<{ isFriend: boolean } | null> {
  const token = accessToken();
  if (!token) return null;
  try {
    const response = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) return { isFriend: true };
    if (response.status === 404) return { isFriend: false };
    console.error("[line] friend check failed", { status: response.status });
    return null;
  } catch {
    return null;
  }
}

/** Friendship for a signed-in LIFF user; a local mock user follows ATLAS_LIFF_MOCK_FRIEND. Null when unknown. */
export async function friendStatusOf(user: { userId: string; mock: boolean }): Promise<boolean | null> {
  if (user.mock) return process.env.ATLAS_LIFF_MOCK_FRIEND !== "false";
  return (await getFriendStatus(user.userId))?.isFriend ?? null;
}

export type PushResult = { status: "sent" } | { status: "skipped" | "failed"; error: string };

/**
 * Pushes messages to one user. retryKey (a UUID) makes the push idempotent on
 * LINE's side. dryRun asks LINE to validate the messages without sending them.
 */
export async function pushLineMessages(to: string, messages: unknown[], options: { retryKey: string; dryRun?: boolean }): Promise<PushResult> {
  const token = accessToken();
  if (!token) return { status: "skipped", error: "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not set" };
  try {
    const response = await fetch(`${API}/message/${options.dryRun ? "validate/push" : "push"}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(options.dryRun ? {} : { "x-line-retry-key": options.retryKey }),
      },
      body: JSON.stringify(options.dryRun ? { messages } : { to, messages }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 409: a push with this retry key was already accepted.
    if (response.ok || response.status === 409) return { status: "sent" };
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    const detail = typeof body?.message === "string" ? body.message.slice(0, 200) : "";
    console.error("[line] push failed", { status: response.status, detail });
    return { status: "failed", error: `LINE ${response.status}${detail ? `: ${detail}` : ""}` };
  } catch {
    return { status: "failed", error: "LINE Messaging API unreachable" };
  }
}

export interface SaleRequestConfirmation {
  reference: string;
  productName: string;
  productDetails?: string;
  transactionIntent: TransactionIntent;
  /** Only a price Atlas verified; null shows it as awaiting confirmation. */
  estimatedPrice: number | null;
  expectedPrice: number;
  submittedAt: Date;
}

const baht = (amount: number) => `฿${amount.toLocaleString("en-US")}`;

/** "5 ต.ค. 2569 เวลา 16:09 น." in Bangkok time. */
export function formatThaiDateTime(date: Date) {
  const day = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day} เวลา ${time} น.`;
}

const ink = "#13231A";
const muted = "#52665B";
const brand = "#00AA52";

function row(label: string, value: string, emphasis?: "bold" | "brand") {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: label, size: "sm", color: muted, flex: 4, wrap: true },
      {
        type: "text", text: value, size: "sm", flex: 6, wrap: true, align: "end",
        color: emphasis === "brand" ? brand : ink, weight: emphasis ? "bold" : "regular",
      },
    ],
  };
}

/** The "we received your request" message pushed to the user after they submit. */
export function saleRequestConfirmationMessage(details: SaleRequestConfirmation) {
  const intent = details.transactionIntent === "outright_sale" ? "ขายขาด" : "ขายฝาก";
  const when = formatThaiDateTime(details.submittedAt);
  return {
    type: "flex",
    altText: `Atlas ได้รับข้อมูลของคุณแล้ว: ${details.productName}${details.estimatedPrice === null ? "" : ` ราคาประเมิน ${baht(details.estimatedPrice)}`} ราคาที่ต้องการ ${baht(details.expectedPrice)}`.slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: brand,
        paddingAll: "20px",
        contents: [
          { type: "text", text: "ATLAS", color: "#D9FBE7", size: "xs", weight: "bold" },
          { type: "text", text: "เราได้รับข้อมูลของคุณแล้ว", color: "#FFFFFF", size: "lg", weight: "bold", wrap: true, margin: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          { type: "text", text: details.productName.slice(0, 200), weight: "bold", size: "md", wrap: true, color: ink },
          ...(details.productDetails ? [{ type: "text", text: details.productDetails.slice(0, 200), size: "xs", color: muted, wrap: true, margin: "sm" }] : []),
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              row("ราคาประเมินเบื้องต้น", details.estimatedPrice === null ? "ทีมงานจะยืนยันอีกครั้ง" : baht(details.estimatedPrice), "bold"),
              row("ราคาที่คุณต้องการ", baht(details.expectedPrice), "brand"),
              row("รูปแบบการทำรายการ", intent),
              row("วันที่และเวลา", when),
              row("เลขอ้างอิง", details.reference),
            ],
          },
          { type: "separator", margin: "lg" },
          {
            type: "text",
            text: "ทีมงาน Atlas จะติดต่อกลับโดยเร็วที่สุด ราคานี้เป็นการประเมินเบื้องต้น ราคาสุดท้ายจะยืนยันหลังตรวจสอบสินค้าจริง",
            size: "xs", color: muted, wrap: true, margin: "lg",
          },
        ],
      },
    },
  };
}
