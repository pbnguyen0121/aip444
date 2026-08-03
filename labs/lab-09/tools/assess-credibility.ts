import { z } from "zod";

export const sourceTypeSchema = z.enum([
  "peer_reviewed_journal",
  "news_organization",
  "government_agency",
  "nonprofit_organization",
  "corporate_blog",
  "personal_blog",
  "social_media",
  "wiki",
  "unknown",
]);

export const editorialProcessSchema = z.enum([
  "peer_reviewed",
  "editor_reviewed",
  "self_published",
  "unknown",
]);

export const sourceLevelSchema = z.enum([
  "primary_source",
  "secondary_source",
  "tertiary_source",
]);

export const overallCredibilitySchema = z.enum([
  "high",
  "medium",
  "low",
  "very_low",
]);

export const credibilityAssessmentSchema = z.object({
  source_url: z
    .string()
    .describe("The complete URL of the source being evaluated."),

  source_type: sourceTypeSchema.describe(
    "The category that best describes the source or publication.",
  ),

  author: z.object({
    name: z
      .string()
      .describe(
        'The author name. Use "Unknown" if the author cannot be identified after investigation.',
      ),

    credentials: z
      .string()
      .describe(
        "The author's qualifications, expertise, affiliations, or a description of what was searched when credentials could not be found.",
      ),

    credibility_assessment: z
      .string()
      .describe(
        "An evidence-based assessment of the author's credibility and how any missing information affects the evaluation.",
      ),
  }),

  publication: z.object({
    name: z
      .string()
      .describe(
        "The publication or website name. Use the domain when no formal publication name is available.",
      ),

    reputation: z
      .string()
      .describe(
        "What the investigation revealed about the publication's reputation, ownership, history, and reliability.",
      ),

    editorial_process: editorialProcessSchema.describe(
      "The type of editorial or review process used by the publication.",
    ),
  }),

  content_analysis: z.object({
    claims_supported_by_evidence: z
      .boolean()
      .describe(
        "Whether the main claims are supported by data, citations, documents, or primary evidence.",
      ),

    sources_cited: z
      .boolean()
      .describe("Whether the source provides citations or links to evidence."),

    corroborated_by_other_sources: z
      .boolean()
      .describe(
        "Whether independent credible sources support the main claims.",
      ),

    contradicted_by_other_sources: z
      .boolean()
      .describe("Whether credible sources contradict any of the main claims."),

    primary_vs_secondary: sourceLevelSchema.describe(
      "Whether the evaluated source is primary, secondary, or tertiary.",
    ),

    funding_or_sponsorship: z
      .string()
      .describe(
        "Known funding, sponsorship, ownership, advertising interests, or a clear statement that this information could not be determined.",
      ),

    date_published: z
      .string()
      .describe(
        "The publication date and whether the information appears current for the topic.",
      ),

    bias_and_tone: z
      .string()
      .describe(
        "An assessment of neutrality, emotional language, persuasion, balance, and acknowledgment of counterarguments.",
      ),
  }),

  transparency_score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      "A score from 1 to 5 for transparency about authorship, methods, evidence, ownership, and funding.",
    ),

  overall_credibility: overallCredibilitySchema.describe(
    "The final credibility rating based on the full investigation.",
  ),

  reasoning: z
    .string()
    .describe(
      "A detailed explanation of the overall rating using specific evidence gathered during the investigation.",
    ),
});

export type CredibilityAssessment = z.infer<typeof credibilityAssessmentSchema>;

export async function assessCredibility(
  evaluation: CredibilityAssessment,
): Promise<{
  status: string;
  evaluation: CredibilityAssessment;
}> {
  return {
    status: "evaluation_recorded",
    evaluation,
  };
}
