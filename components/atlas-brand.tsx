import Image from "next/image";
import Link from "next/link";

type AtlasBrandProps = {
  className?: string;
};

export function AtlasBrand({ className = "" }: AtlasBrandProps) {
  return (
    <Link
      href="/"
      aria-label="Atlas home"
      className={`atlas-focus inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] pr-2 text-lg font-semibold tracking-[-0.035em] text-[var(--color-foreground)] ${className}`}
    >
      <Image
        src="/Brand/Atlas_logo_transparent_bg.png"
        alt=""
        width={8334}
        height={8334}
        preload
        className="h-9 w-9 shrink-0 object-contain"
      />
      <span>Atlas</span>
    </Link>
  );
}
