import path from "node:path";
import { processJobPdf } from "./process-job.js";

async function main() {
  const pdfPath = path.resolve(process.cwd(), "input/jobs/test-job.pdf");

  const result = await processJobPdf(pdfPath);

  console.log(result);
}

main().catch((error) => {
  console.error("[TEST] FAILED");
  console.error(error);
  process.exit(1);
});
