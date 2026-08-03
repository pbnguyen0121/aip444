import dotenv from "dotenv";
import {
  Agent,
  OpenAIProvider,
  Runner,
  setTracingDisabled,
} from "@openai/agents";
import { saveTrace } from "./utils/save-trace.js";
import { credibilitySystemPrompt } from "./prompts/credibility-system-prompt.js";

dotenv.config({
  path: "../../.env",
});

function createReportFilename(sourceUrl: string): string {
  const parsedUrl = new URL(sourceUrl);

  const hostname = parsedUrl.hostname
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-");

  const pathname = parsedUrl.pathname
    .replace(/^\/|\/$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const baseName = pathname ? `${hostname}-${pathname}` : hostname;

  return `${baseName}-credibility-report.md`;
}

function getCalledToolNames(runItems: unknown[]): string[] {
  const toolNames: string[] = [];

  for (const item of runItems) {
    if (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "tool_call_item" &&
      "rawItem" in item
    ) {
      const rawItem = item.rawItem;

      if (
        typeof rawItem === "object" &&
        rawItem !== null &&
        "name" in rawItem &&
        typeof rawItem.name === "string"
      ) {
        toolNames.push(rawItem.name);
      }
    }
  }

  return toolNames;
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing from the root .env file");
  }

  const sourceUrl = process.argv[2];

  if (!sourceUrl) {
    throw new Error(
      'Missing source URL. Run: npm run dev -- "https://example.com"',
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid source URL: ${sourceUrl}`);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Source URL must use http or https.");
  }

  const reportFilename = createReportFilename(sourceUrl);

  const { readUrlTool } = await import("./tools/read-url-tool.js");

  const { webSearchTool } = await import("./tools/web-search-tool.js");

  const { assessCredibilityTool } =
    await import("./tools/assess-credibility-tool.js");

  const { saveReportTool } = await import("./tools/save-report-tool.js");

  setTracingDisabled(true);

  const modelProvider = new OpenAIProvider({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    useResponses: false,
  });

  const agent = new Agent({
    name: "Source Credibility Analyzer Agent",

    instructions: credibilitySystemPrompt,

    model: "openai/gpt-oss-20b:free",

    tools: [readUrlTool, webSearchTool, assessCredibilityTool, saveReportTool],
  });

  const completionAgent = new Agent({
    name: "Credibility Assessment Completion Agent",

    instructions: `
You complete an already-written credibility report.

You must perform exactly these actions:

1. Call assess_credibility using the supplied draft report.
2. Call save_report using the supplied Markdown report.
3. Return one short confirmation.

Do not call read_url.
Do not call web_search.
Do not conduct new research.
Do not rewrite the report before calling the tools.
Do not return the report directly.
`,

    model: "openai/gpt-oss-20b:free",

    tools: [assessCredibilityTool, saveReportTool],
  });

  const runner = new Runner({
    modelProvider,
  });

  console.log("========================================");
  console.log("Source Credibility Analyzer Agent");
  console.log("========================================");
  console.log(`Source URL: ${sourceUrl}`);
  console.log(`Report file: ${reportFilename}`);
  console.log("Starting credibility investigation...\n");

  let result = await runner.run(
    agent,
    `
Evaluate the credibility of this source:

${sourceUrl}

Save the final Markdown report using this exact filename:

${reportFilename}
`,
    {
      maxTurns: 20,
    },
  );

  let allRunItems = [...result.newItems];
  let calledTools = getCalledToolNames(allRunItems);

  console.log("\nTools called during first run:");
  console.log(calledTools.join(", ") || "None");

  const completedStructuredAssessment =
    calledTools.includes("assess_credibility");

  const completedSavedReport = calledTools.includes("save_report");

  if (!completedStructuredAssessment || !completedSavedReport) {
    console.log("\nAgent skipped required tools. Running a completion pass...");

    const missingTools: string[] = [];

    if (!completedStructuredAssessment) {
      missingTools.push("assess_credibility");
    }

    if (!completedSavedReport) {
      missingTools.push("save_report");
    }

    const draftReport = String(result.finalOutput ?? "").trim();

    if (!draftReport) {
      throw new Error(
        "Research pass did not produce a draft report for the completion pass.",
      );
    }

    const completionResult = await runner.run(
      completionAgent,
      `
You previously investigated this source:

${sourceUrl}

Your previous draft report was:

${draftReport}

You did not complete these required tools:

${missingTools.join(", ")}

Do not return another report directly.

You must now complete only the missing required tools listed above.

If assess_credibility is missing:
- Call assess_credibility with a complete evaluation based only on the previous draft.

If save_report is missing:
- Call save_report using the previous draft report as the Markdown content.

Save the Markdown report using this exact filename:

${reportFilename}

Only after save_report succeeds may you return a one-sentence confirmation.
`,
      {
        maxTurns: 6,
      },
    );

    allRunItems = [...allRunItems, ...completionResult.newItems];

    result = completionResult;
    calledTools = getCalledToolNames(allRunItems);
  }

  console.log("\n========== RUN ITEMS ==========\n");

  console.log(`Total run items: ${allRunItems.length}`);
  console.log(`Tools called: ${calledTools.join(", ") || "None"}`);

  console.log("\n========== FINAL OUTPUT ==========\n");

  console.log(result.finalOutput);

  console.log("\nTools called across all passes:");
  console.log(calledTools.join(", ") || "None");

  const requiredTools = [
    "read_url",
    "web_search",
    "assess_credibility",
    "save_report",
  ];

  const missingRequiredTools = requiredTools.filter(
    (toolName) => !calledTools.includes(toolName),
  );

  if (missingRequiredTools.length > 0) {
    throw new Error(
      `Agent did not complete required tools: ${missingRequiredTools.join(", ")}`,
    );
  }

  const tracePath = await saveTrace({
    sourceUrl,
    reportFilename,
    finalOutput: result.finalOutput,
    runItems: allRunItems,
  });

  console.log("\n========== TRACE SAVED ==========\n");
  console.log(tracePath);
}

main().catch((error: unknown) => {
  console.error("\nSource credibility analysis failed.");

  if (error instanceof Error) {
    console.error(`${error.name}: ${error.message}`);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
