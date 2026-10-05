"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, RefreshIcon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { AtlasBackground } from "@/components/atlas-background";
import { AtlasMark } from "@/components/atlas-brand";
import { Button } from "@/components/ui-primitives";
import { useFlowPathname } from "@/lib/flow-navigation";
import { setLiffAuthToken, setLiffReauthenticator } from "@/lib/liff/auth";
import {
  clearRelogin, closeLiffWindow, currentIdToken, initLiff, liffEnvironment, liffFriendship, LiffClientError, relogin, requestAddFriend,
} from "@/lib/liff/client";
import { enterStep, flushLiffEvents, startLiffTracking, trackLiffEvent } from "@/lib/liff/tracker";

type Phase =
  | { kind: "loading" }
  | { kind: "gate"; checking: boolean; notYet: boolean }
  | { kind: "ready" }
  | { kind: "error"; code: string };

class SessionError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function startSession(idToken: string) {
  let response: Response;
  try {
    response = await fetch("/api/liff/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    });
  } catch {
    throw new SessionError("network_error");
  }
  const body = (await response.json().catch(() => null)) as { token?: unknown; isFriend?: unknown; code?: unknown } | null;
  if (!response.ok || typeof body?.token !== "string") throw new SessionError(typeof body?.code === "string" ? body.code : "session_failed");
  return { token: body.token, isFriend: typeof body.isFriend === "boolean" ? body.isFriend : null };
}

async function recheckFriendship(token: string): Promise<boolean | null> {
  try {
    const response = await fetch("/api/liff/session", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = (await response.json().catch(() => null)) as { isFriend?: unknown } | null;
    return response.ok && typeof body?.isFriend === "boolean" ? body.isFriend : null;
  } catch {
    return null;
  }
}

// A token LINE now rejects (expired) is cured only by signing in to LINE again.
const rejectedByLine = (error: unknown) => error instanceof SessionError && error.code === "invalid_id_token";

/** Renews Atlas's session token after it expires, from the current LINE ID token. */
async function renewSession() {
  const idToken = currentIdToken();
  if (!idToken) {
    relogin();
    return false;
  }
  try {
    setLiffAuthToken((await startSession(idToken)).token);
    return true;
  } catch (error) {
    if (rejectedByLine(error)) relogin();
    return false;
  }
}

// One sign-in per page load, shared by React's development double effects.
let signIn: Promise<{ token: string; isFriend: boolean | null } | null> | null = null;

function signInOnce() {
  signIn ??= (async () => {
    const started = await initLiff();
    if ("redirecting" in started) return null;
    let session: Awaited<ReturnType<typeof startSession>>;
    try {
      session = await startSession(started.idToken);
    } catch (error) {
      if (rejectedByLine(error) && relogin()) return null;
      throw error;
    }
    clearRelogin();
    setLiffAuthToken(session.token);
    setLiffReauthenticator(renewSession);
    startLiffTracking(liffEnvironment());
    // When the server cannot tell (no Messaging API token), ask LIFF itself.
    const isFriend = session.isFriend ?? await liffFriendship();
    trackLiffEvent("friendship_checked", { properties: { isFriend, source: session.isFriend === null ? "liff" : "server" } });
    return { token: session.token, isFriend };
  })();
  signIn.catch(() => { signIn = null; });
  return signIn;
}

const errorCopy: Record<string, string> = {
  liff_unconfigured: "ระบบ LINE ของ Atlas ยังตั้งค่าไม่ครบ กรุณาลองใหม่ภายหลัง",
  liff_init_failed: "เปิดหน้านี้ผ่าน LINE ไม่สำเร็จ กรุณาปิดแล้วเปิดลิงก์ใหม่อีกครั้ง",
  missing_id_token: "ยืนยันบัญชี LINE ไม่สำเร็จ กรุณาปิดแล้วเปิดลิงก์ใหม่อีกครั้ง",
  invalid_id_token: "การยืนยันบัญชี LINE หมดอายุ กรุณาปิดแล้วเปิดลิงก์ใหม่อีกครั้ง",
  network_error: "เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
};

function StepTracker() {
  const pathname = useFlowPathname();
  useEffect(() => { enterStep(pathname); }, [pathname]);
  return null;
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="atlas-background flex min-h-dvh items-center justify-center overflow-x-hidden px-4 py-10 text-[var(--color-foreground)]">
      <AtlasBackground />
      <main className="relative z-10 w-full max-w-[30rem]">{children}</main>
    </div>
  );
}

/**
 * The LINE LIFF shell around the valuation flow: signs the user in through
 * LINE, requires them to have added the Atlas OA, then records their journey
 * while rendering the same pages as the web flow.
 */
export function LiffApp({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const token = useRef<string | null>(null);
  const gateShown = useRef(false);

  useEffect(() => {
    let active = true;
    signInOnce().then((session) => {
      if (!active || !session) return;
      token.current = session.token;
      setPhase(session.isFriend === false ? { kind: "gate", checking: false, notYet: false } : { kind: "ready" });
    }).catch((error: unknown) => {
      if (!active) return;
      const code = error instanceof LiffClientError || error instanceof SessionError ? error.code : "session_failed";
      setPhase({ kind: "error", code });
    });
    return () => { active = false; };
  }, []);

  const recheck = useCallback(async (manual: boolean) => {
    if (!token.current) return;
    setPhase({ kind: "gate", checking: true, notYet: false });
    const isFriend = await recheckFriendship(token.current) ?? await liffFriendship();
    if (isFriend) {
      trackLiffEvent("friend_added", { properties: { manual } });
      void flushLiffEvents();
      setPhase({ kind: "ready" });
    } else {
      setPhase({ kind: "gate", checking: false, notYet: manual });
    }
  }, []);

  useEffect(() => {
    if (phase.kind !== "gate") return;
    if (!gateShown.current) {
      gateShown.current = true;
      trackLiffEvent("friend_gate_shown");
    }
    // Coming back from the OA's profile screen re-checks without another tap.
    const onVisible = () => { if (document.visibilityState === "visible") void recheck(false); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase.kind, recheck]);

  if (phase.kind === "ready") {
    return <>{children}<StepTracker /></>;
  }

  if (phase.kind === "loading") {
    return (
      <Screen>
        <div role="status" className="flex flex-col items-center text-center">
          <AtlasMark className="h-14 w-14 animate-pulse object-contain" />
          <p className="mt-4 text-sm font-medium text-[var(--color-muted-foreground)]">กำลังเชื่อมต่อกับ LINE...</p>
        </div>
      </Screen>
    );
  }

  if (phase.kind === "error") {
    return (
      <Screen>
        <section className="atlas-flow-panel atlas-reveal p-6 text-center sm:p-8">
          <HugeiconsIcon icon={Alert02Icon} size={34} strokeWidth={1.8} className="mx-auto text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.05em]">ยังเปิด Atlas ไม่ได้</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">{errorCopy[phase.code] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"}</p>
          <div className="mt-6 grid gap-3">
            <Button onClick={() => window.location.reload()}>
              <HugeiconsIcon icon={RefreshIcon} size={18} strokeWidth={1.8} aria-hidden="true" /> ลองใหม่
            </Button>
            <Button tone="secondary" onClick={() => closeLiffWindow()}>ปิดหน้าต่าง</Button>
          </div>
        </section>
      </Screen>
    );
  }

  return (
    <Screen>
      <section aria-labelledby="friend-gate-title" className="atlas-flow-panel atlas-reveal p-6 text-center sm:p-8">
        <AtlasMark className="mx-auto h-16 w-16 object-contain" />
        <p className="mt-4 text-sm font-semibold text-[var(--color-action-primary)]">ATLAS</p>
        <h1 id="friend-gate-title" className="mt-2 text-2xl font-semibold tracking-[-0.05em]">เพิ่มเพื่อน Atlas ก่อนเริ่มใช้งาน</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">
          Atlas ส่งสรุปผลการประเมินและติดต่อกลับเกี่ยวกับคำขอของคุณผ่าน LINE กรุณาเพิ่ม Atlas เป็นเพื่อน แล้วกลับมาที่หน้านี้เพื่อเริ่มประเมินราคา
        </p>
        <div className="mt-6 grid gap-3">
          <Button disabled={phase.checking} onClick={async () => {
            trackLiffEvent("friend_add_clicked");
            void flushLiffEvents();
            const outcome = await requestAddFriend();
            trackLiffEvent("friend_add_result", { properties: { outcome } });
            if (outcome === "dialog") void recheck(false);
          }}>
            <HugeiconsIcon icon={UserAdd01Icon} size={19} strokeWidth={1.8} aria-hidden="true" /> เพิ่มเพื่อน LINE Atlas
          </Button>
          <Button tone="secondary" disabled={phase.checking} onClick={() => void recheck(true)}>
            {phase.checking ? "กำลังตรวจสอบ..." : "เพิ่มเพื่อนแล้ว เริ่มใช้งาน"}
          </Button>
        </div>
        <p role="status" className="mt-4 min-h-6 text-sm leading-6 text-[var(--color-muted-foreground)]">
          {phase.notYet ? "ยังไม่พบการเพิ่มเพื่อน กรุณากดเพิ่มเพื่อนและตรวจสอบว่าไม่ได้บล็อก Atlas ไว้" : ""}
        </p>
      </section>
    </Screen>
  );
}
