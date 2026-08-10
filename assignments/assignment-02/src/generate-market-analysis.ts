import fs from "node:fs/promises";
import path from "node:path";

import { loadProcessedJobs } from "./lib/load-jobs.js";

import { analyzeMarket } from "./analyze-market.js";

async function main() {
  console.log("[INFO] Loading processed jobs...");

  const jobs = await loadProcessedJobs();

  console.log(`[INFO] Found ${jobs.length} structured job(s).`);

  if (jobs.length < 8) {
    throw new Error(
      `At least 8 structured jobs are required. Found ${jobs.length}.`,
    );
  }

  console.log("[INFO] Generating market analysis...");

  const analysis = await analyzeMarket(jobs);

  const outputPath = path.resolve(
    process.cwd(),
    "data/analysis/market-analysis.json",
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2), "utf8");

  console.log(`[SAVE] ${outputPath}`);

  console.log("\n===== MARKET ANALYSIS SUMMARY =====");

  console.log(`Postings analyzed: ${analysis.totalPostings}`);

  console.log("\nTop required skills:");

  for (const skill of analysis.commonRequiredSkills.slice(0, 10)) {
    console.log(
      `- ${skill.skill}: ${skill.count}/${analysis.totalPostings} (${skill.percentage.toFixed(1)}%)`,
    );
  }

  console.log("\nMarket insights:");

  for (const insight of analysis.marketInsights) {
    console.log(`- ${insight}`);
  }
}

main().catch((error) => {
  console.error("[FATAL]", error instanceof Error ? error.message : error);

  process.exit(1);
});
