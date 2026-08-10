import path from "node:path";
import { extractPdfText } from "./pdf.js";
import { extractJobPosting } from "./extract-job.js";

async function main() {
  const pdfPath = path.resolve(process.cwd(), "input/jobs/test-job.pdf");

  console.log("[TEST] Reading PDF...");

  const text = await extractPdfText(pdfPath);

  console.log(`[TEST] PDF extracted: ${text.length} characters`);

  console.log("[TEST] Calling OpenRouter...");

  const result = await extractJobPosting(text);

  console.log("\n===== STRUCTURED JOB =====\n");

  console.log(JSON.stringify(result.job, null, 2));

  console.log("\n===== LLM USAGE =====");

  console.log("Model used:", result.model);
  console.log("Prompt tokens:", result.usage?.prompt_tokens ?? "unknown");
  console.log(
    "Completion tokens:",
    result.usage?.completion_tokens ?? "unknown",
  );
  console.log("Total tokens:", result.usage?.total_tokens ?? "unknown");
  console.log("Cost:", result.usage?.cost ?? "unknown");

  console.log("\n[TEST] Structured extraction PASSED");
}

main().catch((error) => {
  console.error("\n[TEST] FAILED");
  console.error(error);
  process.exit(1);
});
