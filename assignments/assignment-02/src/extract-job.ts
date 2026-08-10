import { z } from "zod";
import { jobPostingSchema } from "./schemas/job.js";
import { callOpenRouterStructured } from "./lib/openrouter.js";
import { logUsage } from "./lib/usage.js";

const extractionSchema = jobPostingSchema;

const jsonSchema = z.toJSONSchema(extractionSchema);

export async function extractJobPosting(text: string) {
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `
You extract structured information from real job postings.

Rules:
- Use ONLY information present in the job posting.
- Never guess missing information.
- If information is unavailable, use null or an empty array as allowed by the schema.
- requiredSkills should contain hard skills and technologies required by the posting.
- preferredSkills should contain clearly preferred or nice-to-have skills.
- Do not treat generic personality traits as hard technical skills.
- companyResearch MUST be null. Company research will be performed later by a separate tool.
- postingAgeDays must be the number of days old the posting is.
- Today's date is ${today}.
- If the posting contains an explicit posting date, calculate postingAgeDays from that date.
- If it says something like "Posted 3 days ago", use the PDF capture date if one appears in the document.
- If no reliable posting date or relative age can be determined, use null.
- Do not invent salary, experience, education, remote status, or dates.
`.trim();

  const userPrompt = `
Extract the following job posting into the required structured format.

JOB POSTING:

${text}
`.trim();

  const response = await callOpenRouterStructured(
    systemPrompt,
    userPrompt,
    jsonSchema,
    "job_posting",
  );

  console.error("[DEBUG] Model used:", response.model);
  console.error("[DEBUG] Raw LLM content:");
  console.error(response.content);

  let parsedJson: unknown;

  try {
    const cleanedContent = response.content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    parsedJson = JSON.parse(cleanedContent);
  } catch {
    throw new Error("LLM returned content that could not be parsed as JSON.");
  }

  const validation = extractionSchema.safeParse(parsedJson);

  if (!validation.success) {
    console.error(
      "[DEBUG] Structured validation failed:",
      validation.error.format(),
    );

    throw new Error("LLM output failed Zod schema validation.");
  }

  await logUsage({
    timestamp: new Date().toISOString(),
    operation: "job-extraction",
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    cost: response.usage?.cost ?? null,
  });

  return {
    job: validation.data,
    model: response.model,
    usage: response.usage,
  };
}
