import type { ConditionQuestion } from "@/domain/types";

export const mockConditionQuestions: ConditionQuestion[] = [
  {
    id: "screen-condition",
    category: "phone",
    prompt: "What is the condition of the screen?",
    weight: 0.35,
    options: [
      { label: "No visible damage", value: "excellent", normalizedScore: 1 },
      { label: "Minor wear or tiny scratches", value: "good", normalizedScore: 0.75 },
      { label: "Visible cracks or damage", value: "fair", normalizedScore: 0.4 },
      { label: "Severe damage", value: "poor", normalizedScore: 0.15 },
    ],
  },
  {
    id: "battery-health",
    category: "phone",
    prompt: "How would you describe the battery health?",
    weight: 0.3,
    options: [
      { label: "Excellent", value: "excellent", normalizedScore: 1 },
      { label: "Good", value: "good", normalizedScore: 0.75 },
      { label: "Average", value: "fair", normalizedScore: 0.45 },
      { label: "Poor", value: "poor", normalizedScore: 0.2 },
    ],
  },
  {
    id: "body-condition",
    category: "phone",
    prompt: "How is the device body condition?",
    weight: 0.25,
    options: [
      { label: "Like new", value: "excellent", normalizedScore: 1 },
      { label: "Minor wear", value: "good", normalizedScore: 0.75 },
      { label: "Noticeable dents or scratches", value: "fair", normalizedScore: 0.45 },
      { label: "Heavy wear", value: "poor", normalizedScore: 0.2 },
    ],
  },
  {
    id: "functional-status",
    category: "phone",
    prompt: "Does the device power on and function normally?",
    weight: 0.1,
    options: [
      { label: "Fully functional", value: "excellent", normalizedScore: 1 },
      { label: "Mostly functional", value: "good", normalizedScore: 0.7 },
      { label: "Some issues", value: "fair", normalizedScore: 0.5 },
      { label: "Major issues", value: "poor", normalizedScore: 0.2 },
    ],
  },
];
