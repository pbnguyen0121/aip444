import fs from "node:fs/promises";
import path from "node:path";

import { resumeSchema } from "./schemas/resume.js";

import { marketAnalysisSchema } from "./schemas/market-analysis.js";

import { analyzeGaps } from "./analyze-gaps.js";

async function main() {
  const resumePath = path.resolve(process.cwd(), "data/resume/resume.json");

  const marketPath = path.resolve(
    process.cwd(),
    "data/analysis/market-analysis.json",
  );

  const outputPath = path.resolve(
    process.cwd(),
    "data/analysis/gap-analysis.json",
  );

  console.log("[INFO] Loading resume...");

  const resumeRaw = await fs.readFile(resumePath, "utf8");

  const resume = resumeSchema.parse(JSON.parse(resumeRaw));

  console.log("[INFO] Loading market analysis...");

  const marketRaw = await fs.readFile(marketPath, "utf8");

  const market = marketAnalysisSchema.parse(JSON.parse(marketRaw));

  console.log("[INFO] Generating gap analysis...");

  const analysis = await analyzeGaps(resume, market);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2), "utf8");

  console.log(`[SAVE] ${outputPath}`);

  console.log("\n===== GAP ANALYSIS SUMMARY =====");

  console.log(`Strengths: ${analysis.strengths.length}`);

  console.log(`Gaps: ${analysis.gaps.length}`);

  console.log(`Unique value: ${analysis.uniqueValue.length}`);

  console.log("\nGap triage:");

  for (const gap of analysis.gaps) {
    console.log(`- [${gap.level}] ${gap.gap}`);
  }
}

main().catch((error) => {
  console.error("[FATAL]", error instanceof Error ? error.message : error);

  process.exit(1);
});
