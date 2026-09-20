import { DesignPreview } from "@/components/design-preview";

const theme = {
  id: "B",
  name: "Modern Thai Commerce",
  description: "Warmer, friendly Thai consumer-commerce feel.",
  background: "#F8F7F4",
  surface: "#FFFFFF",
  primaryText: "#141815",
  secondaryText: "#5E655F",
  border: "#DFDED8",
  accent: "#1F7A5B",
  cardRadius: 16,
  cardPadding: 16,
  fontStack: '"Noto Sans Thai", "Sarabun", sans-serif',
  shadow: "0 12px 24px rgba(20, 24, 21, 0.06)",
} as const;

export default function Page() {
  return <DesignPreview theme={theme} />;
}
