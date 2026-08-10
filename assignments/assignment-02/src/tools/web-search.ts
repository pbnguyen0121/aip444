import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

const TAVILY_URL = "https://api.tavily.com/search";

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number | null;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

export async function webSearch(
  query: string,
  maxResults = 5,
): Promise<WebSearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured.");
  }

  console.error(`[DEBUG] Tavily search: "${query}"`);

  try {
    const response = await fetch(TAVILY_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Tavily request failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as any;

    const results: WebSearchResult[] = (data.results ?? []).map(
      (result: any) => ({
        title: result.title ?? "",
        url: result.url ?? "",
        content: result.content ?? "",
        score: typeof result.score === "number" ? result.score : null,
      }),
    );

    console.error(`[DEBUG] Tavily returned ${results.length} results.`);

    return {
      query,
      results,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Tavily error";

    throw new Error(`Web search failed for "${query}": ${message}`);
  }
}
