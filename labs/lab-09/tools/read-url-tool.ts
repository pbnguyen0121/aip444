import { tool } from "@openai/agents";
import { z } from "zod";

import { readUrl } from "./read-url.js";

export const readUrlTool = tool({
  name: "read_url",

  description:
    "Read a public web page and return its Markdown content. Always pass the original source URL. Never construct or pass an r.jina.ai URL because this tool handles Jina Reader internally.",

  parameters: z.object({
    url: z
      .string()
      .describe("The complete http or https URL of the web page to read."),
  }),

  execute: async ({ url }) => {
    console.log("\n[Tool] read_url");
    console.log(`[Input] ${url}`);

    try {
      const content = await readUrl(url);

      console.log(`[Result] Returned ${content.length} characters`);

      return content;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`[Error] ${message}`);

      return `Unable to read the page: ${message}`;
    }
  },
});
