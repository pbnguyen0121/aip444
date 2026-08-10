import path from "node:path";
import { extractPdfText } from "./pdf.js";

async function main() {
  const pdfPath = path.resolve(process.cwd(), "input/jobs/test-job.pdf");

  console.log(`[TEST] Reading: ${pdfPath}`);

  const text = await extractPdfText(pdfPath);

  console.log(`[TEST] Extracted characters: ${text.length}`);
  console.log("\n----- FIRST 1500 CHARACTERS -----\n");
  console.log(text.slice(0, 1500));
  console.log("\n----- END PREVIEW -----");
}

main().catch((error) => {
  console.error("[ERROR]", error.message);
  process.exit(1);
});
