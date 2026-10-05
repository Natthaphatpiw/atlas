"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, type ComponentProps } from "react";
import { isLiffPath, LIFF_BASE, toCanonicalPath, toFlowPath } from "@/lib/flow-paths";

// React bindings for lib/flow-paths: pages use web flow paths, and these keep
// a visitor inside whichever copy (web or LINE LIFF) they are using.

export { isLiffPath, LIFF_BASE, toCanonicalPath, toFlowPath };

/** True in the browser while the visitor is inside the LIFF copy of the flow. */
export const isLiffChannel = () => typeof window !== "undefined" && isLiffPath(window.location.pathname);

export function useFlowChannel(): "liff" | "web" {
  return isLiffPath(usePathname()) ? "liff" : "web";
}

export function useFlowPathname() {
  return toCanonicalPath(usePathname() ?? "/");
}

type FlowRouter = Pick<ReturnType<typeof useRouter>, "back" | "forward" | "refresh" | "push" | "replace" | "prefetch">;

/** next/navigation's router, taking web flow paths. */
export function useFlowRouter(): FlowRouter {
  const router = useRouter();
  const base = isLiffPath(usePathname()) ? LIFF_BASE : "";
  return useMemo(() => ({
    back: () => router.back(),
    forward: () => router.forward(),
    refresh: () => router.refresh(),
    push: (href, options) => router.push(toFlowPath(base, href), options),
    replace: (href, options) => router.replace(toFlowPath(base, href), options),
    prefetch: (href, options) => router.prefetch(toFlowPath(base, href), options),
  }), [router, base]);
}

/** next/link, taking a web flow path as href. */
export function FlowLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const base = isLiffPath(usePathname()) ? LIFF_BASE : "";
  return <Link href={toFlowPath(base, href)} {...props} />;
}
