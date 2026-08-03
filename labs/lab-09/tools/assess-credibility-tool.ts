import { tool } from "@openai/agents";
import {
  credibilityAssessmentSchema,
  assessCredibility,
} from "./assess-credibility.js";

export const assessCredibilityTool = tool({
  name: "assess_credibility",

  description:
    "Record a structured credibility assessment after completing all investigation. Every field must be based on evidence. Never guess.",

  parameters: credibilityAssessmentSchema,

  execute: async (evaluation) => {
    console.log("\n[Tool] assess_credibility");
    console.log("[Status] Recording evaluation...");

    const result = await assessCredibility(evaluation);

    console.log("[Status] Evaluation recorded.");

    return result;
  },
});
