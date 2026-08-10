import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "./pdf.js";
import { extractJobPosting } from "./extract-job.js";
import { slugify } from "./lib/slug.js";
import { researchCompany } from "./research-company.js";
import { normalizeJob } from "./lib/normalize.js";

export async function processJobPdf(pdfPath: string) {
  const pdfBaseName = path.basename(pdfPath, path.extname(pdfPath));

  const inputSlug = slugify(pdfBaseName);

  const outputDir = path.resolve(process.cwd(), "data/jobs");

  await fs.mkdir(outputDir, {
    recursive: true,
  });

  const markerPath = path.join(outputDir, `${inputSlug}.json`);

  try {
    await fs.access(markerPath);

    console.log(`[SKIP] Already processed: ${path.basename(pdfPath)}`);

    return {
      skipped: true,
      outputPath: markerPath,
    };
  } catch {
    // Continue because this posting has not been processed.
  }

  console.log(`[INFO] Processing: ${path.basename(pdfPath)}`);

  const text = await extractPdfText(pdfPath);

  const extracted = await extractJobPosting(text);

  console.log(`[INFO] Researching company: ${extracted.job.companyName}`);

  try {
    const research = await researchCompany(extracted.job);

    extracted.job.companyResearch = research;

    console.log(
      `[INFO] Company research completed: ${extracted.job.companyName}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown company research error";

    console.error(`[WARN] Company research failed: ${message}`);

    console.error("[WARN] Continuing with companyResearch = null");

    extracted.job.companyResearch = null;
  }

  const normalizedJob = normalizeJob(extracted.job);

  const finalSlug = slugify(
    `${normalizedJob.jobTitle}-${normalizedJob.companyName}`,
  );

  const finalOutputPath = path.join(outputDir, `${finalSlug}.json`);

  await fs.writeFile(
    finalOutputPath,
    JSON.stringify(normalizedJob, null, 2),
    "utf8",
  );

  // Create lightweight marker using input PDF name
  // so rerunning does not call the LLM again.
  if (finalOutputPath !== markerPath) {
    await fs.writeFile(
      markerPath,
      JSON.stringify(
        {
          processed: true,
          output: path.basename(finalOutputPath),
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  console.log(`[SAVE] ${path.basename(finalOutputPath)}`);

  return {
    skipped: false,
    outputPath: finalOutputPath,
  };
}
