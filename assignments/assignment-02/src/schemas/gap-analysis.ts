import { z } from "zod";

export const gapItemSchema = z.object({
  gap: z.string(),
  level: z.enum(["Quick win", "Short-term", "Medium-term", "Long-term"]),
  reason: z.string(),
  action: z.string(),
});

export const gapAnalysisSchema = z.object({
  strengths: z.array(
    z.object({
      strength: z.string(),
      evidence: z.string(),
    }),
  ),

  gaps: z.array(gapItemSchema),

  uniqueValue: z.array(
    z.object({
      value: z.string(),
      explanation: z.string(),
    }),
  ),

  summary: z.string(),
});

export type GapAnalysis = z.infer<typeof gapAnalysisSchema>;
