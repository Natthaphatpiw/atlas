import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LiffApp } from "@/components/liff/liff-app";

export const metadata: Metadata = {
  title: "Atlas",
  description: "ประเมินราคาสินค้า IT เบื้องต้นผ่าน LINE",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Everything under /liff is the LINE LIFF app: the web flow's pages behind a
// LINE sign-in, an add-friend requirement and usage recording.
export default function LiffLayout({ children }: { children: ReactNode }) {
  return <LiffApp>{children}</LiffApp>;
}
