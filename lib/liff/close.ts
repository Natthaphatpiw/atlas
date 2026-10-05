import { closeLiffWindow } from "@/lib/liff/client";
import { flushLiffEvents, trackLiffEvent } from "@/lib/liff/tracker";

/** Records the close, gives queued events a moment to send, then closes LIFF. False if LIFF cannot close here. */
export async function finishLiffVisit(from: string) {
  trackLiffEvent("liff_closed", { properties: { from } });
  await Promise.race([flushLiffEvents(), new Promise((resolve) => setTimeout(resolve, 800))]);
  return closeLiffWindow();
}
