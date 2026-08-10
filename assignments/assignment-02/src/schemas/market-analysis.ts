import { z } from "zod";

export const skillFrequencySchema = z.object({
  skill: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
});

export const marketAnalysisSchema = z.object({
  totalPostings: z.number().int().positive(),

  commonRequiredSkills: z.array(skillFrequencySchema),

  commonPreferredSkills: z.array(skillFrequencySchema),

  salaryAnalysis: z.object({
    postingsWithSalary: z.number().int().nonnegative(),
    postingsWithoutSalary: z.number().int().nonnegative(),
    observedRanges: z.array(z.string()),
    summary: z.string().nullable(),
  }),

  experiencePatterns: z.array(z.string()),

  educationPatterns: z.array(z.string()),

  remoteWork: z.object({
    remote: z.number().int().nonnegative(),
    hybrid: z.number().int().nonnegative(),
    inPerson: z.number().int().nonnegative(),
    notSpecified: z.number().int().nonnegative(),
    summary: z.string(),
  }),

  companySizeDistribution: z.array(
    z.object({
      category: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),

  marketInsights: z.array(z.string()),
});

export type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;
