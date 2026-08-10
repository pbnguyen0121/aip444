import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export interface StructuredResponse {
  content: string;
  model: string;
  usage?: OpenRouterUsage;
}

/**
 * Retry OpenRouter requests when the provider returns HTTP 429.
 * This is especially useful for shared free-model rate limits.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    // Success
    if (response.ok) {
      return response;
    }

    // Not a rate-limit error, so don't retry.
    if (response.status !== 429) {
      return response;
    }

    // We already used all retries.
    if (attempt === maxRetries) {
      return response;
    }

    const retryAfterHeader = response.headers.get("retry-after");

    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 2;

    const baseWait = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 2;

    // Small backoff:
    // retry 1 -> 2 sec
    // retry 2 -> 4 sec
    // retry 3 -> 6 sec
    const waitMs = baseWait * 1000 * (attempt + 1);

    console.error(
      `[WARN] OpenRouter rate limited. ` +
        `Retry ${attempt + 1}/${maxRetries} ` +
        `in ${waitMs / 1000}s...`,
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error("Unexpected OpenRouter retry loop failure.");
}

export async function callOpenRouterStructured(
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: object,
  schemaName = "structured_response",
): Promise<StructuredResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.LLM_MODEL || "openrouter/free";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetchWithRetry(OPENROUTER_URL, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      model,

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],

      response_format: {
        type: "json_schema",

        json_schema: {
          name: schemaName,
          strict: true,
          schema: jsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as any;

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter returned no message content.");
  }

  return {
    content,
    model: data.model ?? model,
    usage: data.usage,
  };
}
