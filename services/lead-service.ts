import type { Lead } from "@/domain/types";

export interface LeadService {
  submitLead(input: Omit<Lead, "id" | "createdAt">): Promise<Lead>;
}
