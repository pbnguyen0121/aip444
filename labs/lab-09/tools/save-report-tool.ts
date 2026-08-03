import { tool } from "@openai/agents";
import { z } from "zod";

import { saveReport } from "./save-report.js";

export const saveReportTool = tool({
  name: "save_report",

  description:
    "Save the final credibility analysis as a Markdown file. Use this only after assess_credibility has been completed successfully.",

  parameters: z.object({
    filename: z
      .string()
      .describe(
        "A safe Markdown filename for the report, such as example-domain-report.md.",
      ),

    content: z
      .string()
      .describe(
        "The complete final credibility report written in Markdown format.",
      ),
  }),

  execute: async ({ filename, content }) => {
    console.log("\n[Tool] save_report");
    console.log(`[Filename] ${filename}`);

    const result = await saveReport(filename, content);

    console.log(`[Status] Report saved to ${result.path}`);

    return result;
  },
});
