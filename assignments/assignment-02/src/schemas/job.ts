import { z } from "zod";

export const companyResearchSchema = z.object({
  companySize: z.string().nullable(),
  industry: z.string().nullable(),
  recentNews: z.array(z.string()),
  cultureSignals: z.array(z.string()),
  additionalContext: z.array(z.string()),
});

export const jobPostingSchema = z.object({
  jobTitle: z.string(),
  companyName: z.string(),
  location: z.string().nullable(),
  remoteStatus: z.string().nullable(),

  postingAgeDays: z.number().int().nonnegative().nullable(),

  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),

  experienceLevel: z.string().nullable(),
  educationRequirements: z.array(z.string()),

  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryCurrency: z.string().nullable(),

  keyResponsibilities: z.array(z.string()),

  companyResearch: companyResearchSchema.nullable(),
});

export type JobPosting = z.infer<typeof jobPostingSchema>;
