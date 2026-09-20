import { DesignPreview } from "@/components/design-preview";

const theme = {
  id: "C",
  name: "Premium Neutral / Restrained",
  description: "Premium, restrained feel.",
  background: "#F7F5F2",
  surface: "#FFFFFF",
  primaryText: "#1E1D1A",
  secondaryText: "#6C655F",
  border: "#E1DCD3",
  accent: "#2C2A29",
  cardRadius: 14,
  cardPadding: 14,
  fontStack: '"IBM Plex Sans Thai", "Noto Sans Thai", sans-serif',
  shadow: "0 10px 18px rgba(30, 29, 26, 0.04)",
} as const;

export default function Page() {
  return <DesignPreview theme={theme} />;
}
