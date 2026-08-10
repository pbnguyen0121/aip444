import { z } from "zod";

import { marketAnalysisSchema } from "./schemas/market-analysis.js";

import { type JobPosting } from "./schemas/job.js";

import { callOpenRouterStructured } from "./lib/openrouter.js";

import { logUsage } from "./lib/usage.js";

function cleanJsonContent(content: string): string {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function analyzeMarket(jobs: JobPosting[]) {
  const systemPrompt = `
You are analyzing structured job postings
from the same general software-development market.

Analyze patterns across ALL supplied postings.

Rules:
- Base every conclusion only on supplied job data.
- Do not invent missing information.
- Normalize obvious skill-name variants when counting.
  Example: "React.js" and "React" may be treated as React.
- A skill count represents the number of postings
  mentioning that skill, not the number of times the
  skill appears inside one posting.
- percentage = count / totalPostings * 100.
- Keep percentages between 0 and 100.
- Do not treat missing salary as zero salary.
- Salary periods may differ (hourly, monthly, yearly).
  Do not mathematically combine incompatible periods.
- Summarize observed salary information honestly.
- Determine experience and education patterns from
  what postings explicitly state.
- Categorize remote status conservatively as remote,
  hybrid, in-person, or not specified.
- Use company research when available for company-size
  distribution.
- If company size is unavailable, categorize it as
  "Unknown".
- marketInsights should contain concise, useful
  conclusions for a job seeker.
`.trim();

  const userPrompt = `
Analyze these ${jobs.length} job postings.

STRUCTURED JOB DATA:

${JSON.stringify(jobs, null, 2)}
`.trim();

  const response = await callOpenRouterStructured(
    systemPrompt,
    userPrompt,
    z.toJSONSchema(marketAnalysisSchema),
    "market_analysis",
  );

  await logUsage({
    timestamp: new Date().toISOString(),
    operation: "market-analysis",
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    cost: response.usage?.cost ?? null,
  });

  const parsed = JSON.parse(cleanJsonContent(response.content));

  return marketAnalysisSchema.parse(parsed);
}
