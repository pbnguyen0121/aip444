import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

import { FlashcardResponseSchema, type FlashcardResponse } from "./schemas.js";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error(
    "OPENROUTER_API_KEY is missing. Please add OPENROUTER_API_KEY=sk-... to your root .env file.",
  );
}

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
});

const MODEL = "openai/gpt-4.1-nano";

async function loadSystemPrompt() {
  const promptPath = path.join(process.cwd(), "SYSTEM_PROMPT.md");
  return readFile(promptPath, "utf-8");
}

function buildUserPrompt(notes: string, cards: number) {
  return `
Generate exactly ${cards} structured ACE flashcard(s) from the course notes below.

Critical reminders:
- Use only the notes inside <course_notes>.
- Each evidence field must be a direct quote from the notes.
- Do not hallucinate.
- Expand acronyms in the challenge field.
- Use student voice for misconception.
- Return data that matches the provided schema.

<course_notes>
${notes}
</course_notes>
`;
}

export async function generateFlashcards(
  notes: string,
  cards: number,
): Promise<FlashcardResponse> {
  const systemPrompt = await loadSystemPrompt();
  const userPrompt = buildUserPrompt(notes, cards);

  const startTime = performance.now();

  const completion = await client.chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(FlashcardResponseSchema, "flashcards"),
  });

  const durationMs = performance.now() - startTime;

  const usage = completion.usage;
  if (usage) {
    const totalTokens = usage.total_tokens ?? 0;
    const duration =
      durationMs >= 1000
        ? `${(durationMs / 1000).toFixed(2)}s`
        : `${durationMs.toFixed(0)}ms`;

    console.error(`Model: ${MODEL}`);
    console.error(`Tokens used: ${totalTokens}`);
    console.error(`Request time: ${duration}`);
  }

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(`Model refused: ${message.refusal}`);
  }

  if (!message?.parsed) {
    throw new Error("Model did not return parsed structured output.");
  }

  return message.parsed;
}
