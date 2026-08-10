import { z } from "zod";

import type { Resume } from "./schemas/resume.js";

import type { MarketAnalysis } from "./schemas/market-analysis.js";

import { gapAnalysisSchema } from "./schemas/gap-analysis.js";

import { callOpenRouterStructured } from "./lib/openrouter.js";

import { logUsage } from "./lib/usage.js";

function cleanJsonContent(content: string): string {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function analyzeGaps(resume: Resume, market: MarketAnalysis) {
  const systemPrompt = `
You are analyzing a candidate's resume against
an aggregated software-development job market.

Use ONLY the supplied resume and market analysis.

Identify:

1. Strengths:
Skills and qualifications the candidate already has
that are commonly requested in the market.

2. Gaps:
Skills or qualifications that appear frequently in
the market but are missing or underrepresented
in the resume.

3. Unique value:
Useful strengths or experiences the candidate has
that are not common across the postings.

Every gap must be triaged as one of:

Quick win:
The candidate likely already has the skill or
experience, but the resume wording does not clearly
show it.

Short-term:
Can reasonably be improved in days to weeks.

Medium-term:
Requires weeks to months of practice, learning,
or project work.

Long-term:
Requires significant experience, education,
or structural career development.

Rules:
- Never invent resume experience.
- Be specific and actionable.
- Avoid generic advice like "learn AWS".
- Prefer concrete actions such as a specific project,
  certification, tutorial path, or resume wording change.
- Do not claim the candidate has a skill unless the
  resume supports it.
- Prioritize gaps that appear frequently in the market.
`.trim();

  const userPrompt = `
RESUME:

${JSON.stringify(resume, null, 2)}

MARKET ANALYSIS:

${JSON.stringify(market, null, 2)}
`.trim();

  const response = await callOpenRouterStructured(
    systemPrompt,
    userPrompt,
    z.toJSONSchema(gapAnalysisSchema),
    "gap_analysis",
  );

  await logUsage({
    timestamp: new Date().toISOString(),
    operation: "gap-analysis",
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    cost: response.usage?.cost ?? null,
  });

  const parsed = JSON.parse(cleanJsonContent(response.content));

  return gapAnalysisSchema.parse(parsed);
}
