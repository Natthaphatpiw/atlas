import { DesignPreview } from "@/components/design-preview";

const theme = {
  id: "A",
  name: "Calm Fintech / Recommerce",
  description: "Calm, trustworthy recommerce feel.",
  background: "#F5F7F4",
  surface: "#FFFFFF",
  primaryText: "#12211D",
  secondaryText: "#5A675E",
  border: "#D8E0DB",
  accent: "#0F766E",
  cardRadius: 18,
  cardPadding: 18,
  fontStack: '"Noto Sans Thai", "Inter", sans-serif',
  shadow: "0 14px 30px rgba(18, 33, 29, 0.06)",
} as const;

export default function Page() {
  return <DesignPreview theme={theme} />;
}
