import type { AnalyticsEvent } from "@/domain/types";

export interface AnalyticsService {
  track(event: AnalyticsEvent): void;
}
