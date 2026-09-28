"use client";

import { useSyncExternalStore } from "react";
import { Lottie } from "lottie-react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
// The complete mark is still fully visible at frame 72, after the celebratory particles have played.
const SUCCESS_HOLD_FRAME = 72;

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionPreference() {
  return window.matchMedia(reducedMotionQuery).matches;
}

export function SuccessAnimation() {
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotionPreference, () => false);

  return (
    <div className="mx-auto h-40 w-40 sm:h-48 sm:w-48">
      <Lottie
        src="/lottie/successfully-done.json"
        autoplay={!reducedMotion}
        loop={false}
        segment={reducedMotion ? [SUCCESS_HOLD_FRAME, SUCCESS_HOLD_FRAME] : [0, SUCCESS_HOLD_FRAME]}
        className="h-full max-h-full w-full max-w-full"
        style={{ width: "100%", height: "100%" }}
        aria-label="ส่งคำขอประเมินเรียบร้อยแล้ว"
        role="img"
      />
    </div>
  );
}
