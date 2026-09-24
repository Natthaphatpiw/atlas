import type { ReactNode } from "react";

type ContainerSize = "shell" | "flow" | "form" | "financial";

const sizeClasses: Record<ContainerSize, string> = {
  shell: "max-w-[var(--layout-shell)]",
  flow: "max-w-[var(--layout-flow)]",
  form: "max-w-[var(--layout-form)]",
  financial: "max-w-[var(--layout-financial)]",
};

export function PageContainer({
  children,
  className = "",
  size = "shell",
}: {
  children: ReactNode;
  className?: string;
  size?: ContainerSize;
}) {
  return <div className={`mx-auto w-full ${sizeClasses[size]} ${className}`}>{children}</div>;
}
