import { tavily } from "@tavily/core";

const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  throw new Error("TAVILY_API_KEY is missing from the root .env file");
}

const tavilyClient = tavily({
  apiKey,
});

export async function webSearch(query: string): Promise<object> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new Error("Search query cannot be empty.");
  }

  const response = await tavilyClient.search(trimmedQuery, {
    searchDepth: "basic",
    maxResults: 3,
    includeAnswer: false,
    includeRawContent: false,
  });

  return {
    query: response.query,
    results: response.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
    })),
  };
}
