import { z } from "zod";

import { resumeSchema } from "./schemas/resume.js";

import { callOpenRouterStructured } from "./lib/openrouter.js";

import { logUsage } from "./lib/usage.js";

function cleanJsonContent(content: string): string {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function extractResume(text: string) {
  const systemPrompt = `
You extract structured information from a resume.

Use ONLY information explicitly present in the resume.

Rules:
- Never invent qualifications, skills, experience,
  projects, certifications, employers, or education.
- If optional information is unavailable, use null.
- If a category has no entries, use an empty array.
- skills should contain technical and professionally
  relevant skills explicitly supported by the resume.
- Work-experience technologies must only include
  technologies supported by that specific experience.
- Do not infer technologies merely from a job title.
- Projects must only contain projects actually listed
  in the resume.
- Certifications must only contain certifications
  actually listed in the resume.
`.trim();

  const userPrompt = `
Extract this resume into the required structured format.

RESUME:

${text}
`.trim();

  const response = await callOpenRouterStructured(
    systemPrompt,
    userPrompt,
    z.toJSONSchema(resumeSchema),
    "resume",
  );

  const parsed = JSON.parse(cleanJsonContent(response.content));

  const validation = resumeSchema.safeParse(parsed);

  if (!validation.success) {
    console.error(
      "[DEBUG] Resume validation failed:",
      validation.error.format(),
    );

    throw new Error("Resume output failed Zod validation.");
  }

  await logUsage({
    timestamp: new Date().toISOString(),
    operation: "resume-extraction",
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null,
    cost: response.usage?.cost ?? null,
  });

  return validation.data;
}
