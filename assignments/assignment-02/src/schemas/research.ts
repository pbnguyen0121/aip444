import { z } from "zod";

export const researchPlanSchema = z.object({
  queries: z.array(z.string()).min(1).max(3),
});

export type ResearchPlan = z.infer<typeof researchPlanSchema>;
