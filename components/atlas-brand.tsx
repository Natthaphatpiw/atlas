import Image from "next/image";
import { FlowLink } from "@/lib/flow-navigation";
import atlasLogo from "@/public/Brand/Atlas_logo_transparent_bg.png";

type AtlasBrandProps = {
  className?: string;
};

export function AtlasMark({ className = "" }: { className?: string }) {
  return <Image src={atlasLogo} alt="" preload className={className} />;
}

export function AtlasBrand({ className = "" }: AtlasBrandProps) {
  return (
    <FlowLink
      href="/"
      aria-label="Atlas home"
      className={`atlas-focus inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] pr-2 text-lg font-semibold tracking-[-0.035em] text-[var(--color-foreground)] ${className}`}
    >
      <AtlasMark className="h-9 w-9 shrink-0 object-contain" />
      <span>Atlas</span>
    </FlowLink>
  );
}
