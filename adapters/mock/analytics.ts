import type { AnalyticsEvent } from "@/domain/types";
import type { AnalyticsService } from "@/services/analytics-service";

export class MockAnalyticsService implements AnalyticsService {
  track(event: AnalyticsEvent) {
    // Intentionally no-op for the MVP scaffold; later replaced by a real vendor adapter.
    console.info("[Atlast analytics mock]", event);
  }
}
