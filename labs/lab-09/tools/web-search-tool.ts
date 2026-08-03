import { tool } from "@openai/agents";
import { z } from "zod";

import { webSearch } from "./web-search.js";

const MAX_WEB_SEARCH_CALLS = 3;

let webSearchCallCount = 0;

export const webSearchTool = tool({
  name: "web_search",

  description:
    "Search the web for focused credibility evidence. This tool may be called no more than three times during one analysis. Combine related questions into one query and proceed to assess_credibility after enough evidence is gathered.",

  parameters: z.object({
    query: z
      .string()
      .describe(
        "One focused search query. Combine related author, publication, or claim questions whenever possible.",
      ),
  }),

  execute: async ({ query }) => {
    if (webSearchCallCount >= MAX_WEB_SEARCH_CALLS) {
      console.log("\n[Tool] web_search");
      console.log("[Limit] Maximum of 3 searches reached.");

      return {
        status: "search_limit_reached",
        message:
          "The maximum number of web searches has been reached. Do not call web_search again. Use the evidence already gathered and proceed to assess_credibility, then save_report.",
      };
    }

    webSearchCallCount += 1;

    console.log("\n[Tool] web_search");
    console.log(
      `[Query ${webSearchCallCount}/${MAX_WEB_SEARCH_CALLS}] ${query}`,
    );

    const results = await webSearch(query);

    console.log("[Result] Search completed");

    return results;
  },
});
