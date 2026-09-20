import type { Lead } from "@/domain/types";
import type { LeadService } from "@/services/lead-service";

export class MockLeadService implements LeadService {
  async submitLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
    return {
      ...input,
      id: `mock-lead-${input.sessionId}`,
      createdAt: new Date().toISOString(),
    };
  }
}
