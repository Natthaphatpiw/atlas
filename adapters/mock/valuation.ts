import type { Device, EstimatedPrice, ValuationSession } from "@/domain/types";
import type { ValuationService } from "@/services/valuation-service";

export class MockValuationService implements ValuationService {
  async getDeviceCatalog() {
    const { mockDevices } = await import("@/adapters/mock/devices");
    return mockDevices;
  }

  async getConditionQuestions(deviceCategory: Device["category"]) {
    const { mockConditionQuestions } = await import("@/adapters/mock/condition-questions");
    return mockConditionQuestions.filter((question) => question.category === deviceCategory);
  }

  async estimateValue(session: ValuationSession): Promise<EstimatedPrice> {
    const baseAmount = 14500;
    const conditionWeight = session.conditionAnswers.reduce((total, answer) => {
      return total + answer.normalizedScore * answer.weight;
    }, 0);

    const normalizedCondition = Math.max(0, Math.min(1, conditionWeight));
    const expectedAmount = session.expectedPrice?.amount ?? baseAmount;
    const marketAdjustment = Math.round((expectedAmount - baseAmount) * 0.18);
    const conditionAdjustment = Math.round((1 - normalizedCondition) * 12000);
    const estimatedAmount = Math.max(1500, expectedAmount + marketAdjustment - conditionAdjustment);

    return {
      amount: estimatedAmount,
      currency: "THB",
      confidence: 0.68,
      rangeMin: Math.max(1000, estimatedAmount - 3500),
      rangeMax: estimatedAmount + 4000,
      formulaVersion: "mock-demo-v1",
      breakdown: {
        baseValue: baseAmount,
        conditionAdjustment: -conditionAdjustment,
        marketAdjustment: marketAdjustment,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getMockValuationResult(session: ValuationSession): Promise<{ minPrice: number; maxPrice: number; currency: "THB" }> {
    void session;

    return {
      minPrice: 24500,
      maxPrice: 27000,
      currency: "THB",
    };
  }
}
