import { z } from "zod";

export const evidenceItemSchema = z.object({
  finding: z.string(),
  evidence: z.string(),
  source: z.string().nullable(),
});

export const legitimacyAssessmentSchema = z.object({
  verdict: z.enum(["GREEN", "YELLOW", "RED"]),
  confidence: z.number().int().min(0).max(100),
  greenFlags: z.array(evidenceItemSchema),
  redFlags: z.array(evidenceItemSchema),
  recommendation: z.string(),
});

export const fitAssessmentSchema = z.object({
  score: z.number().int().min(0).max(100),
  category: z.enum([
    "strong fit",
    "good fit and should apply",
    "stretch but may still be worth applying",
    "major growth target",
  ]),
  breakdown: z.array(
    z.object({
      factor: z.string(),
      points: z.number().int().min(0),
      maxPoints: z.number().int().positive(),
      evidence: z.string(),
    }),
  ),
  summary: z.string(),
});

export const resumeAdaptationSchema = z.object({
  recommendations: z.array(
    z.object({
      targetRequirement: z.string(),
      resumeEvidence: z.string(),
      suggestedChange: z.string(),
    }),
  ),
});

export const coverLetterGuidanceSchema = z.object({
  openingAngle: z.string(),
  companySpecificPoints: z.array(z.string()),
  roleSpecificPoints: z.array(z.string()),
  evidenceToHighlight: z.array(z.string()),
  cautions: z.array(z.string()),
});

export const interviewPrepSchema = z.object({
  likelyQuestions: z.array(z.string()),
  skillsToReview: z.array(z.string()),
  companyTopicsToResearch: z.array(z.string()),
  talkingPoints: z.array(
    z.object({
      resumeEvidence: z.string(),
      roleConnection: z.string(),
    }),
  ),
});

export type LegitimacyAssessment = z.infer<
  typeof legitimacyAssessmentSchema
>;
export type FitAssessment = z.infer<typeof fitAssessmentSchema>;
export type ResumeAdaptation = z.infer<typeof resumeAdaptationSchema>;
export type CoverLetterGuidance = z.infer<typeof coverLetterGuidanceSchema>;
export type InterviewPrep = z.infer<typeof interviewPrepSchema>;
