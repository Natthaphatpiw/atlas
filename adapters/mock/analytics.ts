import type { AnalyticsEvent } from "@/domain/types";
import type { AnalyticsService } from "@/services/analytics-service";

type AnalyticsSink = (event: AnalyticsEvent) => void;
const sinks = new Set<AnalyticsSink>();

/** Receives every tracked event until the returned function is called; the LIFF app records them this way. */
export function addAnalyticsSink(sink: AnalyticsSink) {
  sinks.add(sink);
  return () => { sinks.delete(sink); };
}

export class MockAnalyticsService implements AnalyticsService {
  track(event: AnalyticsEvent) {
    // No vendor yet: logs, then hands the event to any registered sink.
    console.info("[Atlas analytics mock]", event);
    for (const sink of sinks) {
      try {
        sink(event);
      } catch {
        // A failing recorder must never break the flow it observes.
      }
    }
  }
}
