import fs from "node:fs/promises";
import path from "node:path";

import { processJobPdf } from "./process-job.js";

async function main() {
  const inputDir = path.resolve(process.cwd(), "input/jobs");

  console.log("====================================");
  console.log(" Assignment 2 - Phase 1");
  console.log(" Job Market Analysis");
  console.log("====================================\n");

  let files: string[];

  try {
    files = await fs.readdir(inputDir);
  } catch {
    throw new Error(`Job input directory not found: ${inputDir}`);
  }

  const pdfFiles = files
    .filter((file) => file.toLowerCase().endsWith(".pdf"))
    .sort();

  if (pdfFiles.length === 0) {
    throw new Error("No job PDF files found in input/jobs.");
  }

  console.log(`[INFO] Found ${pdfFiles.length} PDF job posting(s).\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of pdfFiles) {
    const filePath = path.join(inputDir, file);

    console.log(`\n------------------------------------`);
    console.log(`[JOB] ${file}`);
    console.log(`------------------------------------`);

    try {
      const result = await processJobPdf(filePath);

      if (result.skipped) {
        skipped++;
      } else {
        processed++;
      }
    } catch (error) {
      failed++;

      const message = error instanceof Error ? error.message : "Unknown error";

      console.error(`[ERROR] Failed to process ${file}: ${message}`);

      console.error("[INFO] Continuing with remaining jobs.");
    }
  }

  console.log("\n====================================");

  console.log(" PHASE 1 EXTRACTION SUMMARY");

  console.log("====================================");

  console.log(`Total PDFs : ${pdfFiles.length}`);

  console.log(`Processed  : ${processed}`);

  console.log(`Skipped    : ${skipped}`);

  console.log(`Failed     : ${failed}`);

  console.log("====================================");

  if (failed > 0) {
    console.error(`[WARN] ${failed} posting(s) failed. Review errors above.`);
  }
}

main().catch((error) => {
  console.error("\n[FATAL]", error instanceof Error ? error.message : error);

  process.exit(1);
});
