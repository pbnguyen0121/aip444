import { z } from "zod";

import { companyResearchSchema, type JobPosting } from "./schemas/job.js";

import { researchPlanSchema } from "./schemas/research.js";

import { callOpenRouterStructured } from "./lib/openrouter.js";

import { logUsage } from "./lib/usage.js";

import { webSearch } from "./tools/web-search.js";

function cleanJsonContent(content: string): string {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function recordUsage(
  operation: string,
  response: Awaited<ReturnType<typeof callOpenRouterStructured>>,
) {
  await logUsage({
    timestamp: new Date().toISOString(),
    operation,
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    cost: response.usage?.cost ?? null,
  });
}

export async function researchCompany(job: JobPosting) {
  // -----------------------------
  // STEP 1: LLM decides what to research
  // -----------------------------

  const planPrompt = `
You are planning web research about a company
that posted a job.

Decide what web searches would be most useful
for a job applicant.

Focus on information such as:
- company size
- industry
- recent news, expansion, or layoffs
- workplace culture
- employee reviews
- other context useful to an applicant

Generate between 1 and 3 concise search queries.

Do not answer the research questions yourself.
Only produce search queries.
`.trim();

  const planUserPrompt = `
Company: ${job.companyName}
Job title: ${job.jobTitle}
Location: ${job.location ?? "not listed"}
`.trim();

  const planResponse = await callOpenRouterStructured(
    planPrompt,
    planUserPrompt,
    z.toJSONSchema(researchPlanSchema),
    "company_research_plan",
  );

  await recordUsage("company-research-plan", planResponse);

  const plan = researchPlanSchema.parse(
    JSON.parse(cleanJsonContent(planResponse.content)),
  );

  console.error(`[DEBUG] Research queries selected by LLM:`, plan.queries);

  // -----------------------------
  // STEP 2: Tavily executes searches
  // -----------------------------

  const evidence: string[] = [];

  for (const query of plan.queries) {
    const search = await webSearch(query, 3);

    for (const result of search.results) {
      evidence.push(
        [
          `QUERY: ${query}`,
          `TITLE: ${result.title}`,
          `URL: ${result.url}`,
          `CONTENT: ${result.content}`,
        ].join("\n"),
      );
    }
  }

  if (evidence.length === 0) {
    console.error("[WARN] No company research evidence was returned.");

    return {
      companySize: null,
      industry: null,
      recentNews: [],
      cultureSignals: [],
      additionalContext: [],
    };
  }

  // Keep context bounded.
  const researchEvidence = evidence.slice(0, 9).join("\n\n---\n\n");

  // -----------------------------
  // STEP 3: LLM synthesizes evidence
  // -----------------------------

  const synthesisPrompt = `
You analyze web research about a company
for a job applicant.

Use ONLY the supplied web-search evidence.

Rules:
- Do not invent facts.
- If company size cannot be established,
  use null.
- If industry cannot be established,
  use null.
- recentNews should contain concise,
  applicant-relevant developments.
- cultureSignals should contain only
  evidence-supported workplace or culture signals.
- additionalContext may contain other useful
  evidence-supported information.
- Keep the result concise.
`.trim();

  const synthesisUserPrompt = `
Company: ${job.companyName}
Job: ${job.jobTitle}

WEB SEARCH EVIDENCE:

${researchEvidence}
`.trim();

  const synthesisResponse = await callOpenRouterStructured(
    synthesisPrompt,
    synthesisUserPrompt,
    z.toJSONSchema(companyResearchSchema),
    "company_research",
  );

  await recordUsage("company-research-synthesis", synthesisResponse);

  const research = companyResearchSchema.parse(
    JSON.parse(cleanJsonContent(synthesisResponse.content)),
  );

  return research;
}
