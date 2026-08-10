import fs from "node:fs/promises";
import path from "node:path";

import { marketAnalysisSchema } from "./schemas/market-analysis.js";

async function main() {
  const inputPath = path.resolve(
    process.cwd(),
    "data/analysis/market-analysis.json",
  );

  const outputPath = path.resolve(process.cwd(), "reports/market-analysis.md");

  const raw = await fs.readFile(inputPath, "utf8");

  const market = marketAnalysisSchema.parse(JSON.parse(raw));

  const lines: string[] = [];

  lines.push("# Job Market Analysis");
  lines.push("");
  lines.push(`This analysis is based on ${market.totalPostings} job postings.`);
  lines.push("");

  lines.push("## Most Common Required Skills");
  lines.push("");
  lines.push("| Skill | Postings | Percentage |");
  lines.push("|---|---:|---:|");

  for (const skill of market.commonRequiredSkills) {
    lines.push(
      `| ${skill.skill} | ${skill.count}/${market.totalPostings} | ${skill.percentage.toFixed(1)}% |`,
    );
  }

  lines.push("");
  lines.push("## Preferred Skills");
  lines.push("");

  if (market.commonPreferredSkills.length === 0) {
    lines.push("No consistent preferred skills were identified.");
  } else {
    for (const skill of market.commonPreferredSkills) {
      lines.push(
        `- ${skill.skill}: ${skill.count}/${market.totalPostings} postings`,
      );
    }
  }

  lines.push("");
  lines.push("## Experience Patterns");
  lines.push("");

  for (const item of market.experiencePatterns) {
    lines.push(`- ${item}`);
  }

  lines.push("");
  lines.push("## Education Patterns");
  lines.push("");

  for (const item of market.educationPatterns) {
    lines.push(`- ${item}`);
  }

  lines.push("");
  lines.push("## Salary Analysis");
  lines.push("");
  lines.push(
    `Postings with salary information: ${market.salaryAnalysis.postingsWithSalary}`,
  );
  lines.push("");
  lines.push(
    `Postings without salary information: ${market.salaryAnalysis.postingsWithoutSalary}`,
  );
  lines.push("");

  if (market.salaryAnalysis.summary) {
    lines.push(market.salaryAnalysis.summary);
    lines.push("");
  }

  for (const range of market.salaryAnalysis.observedRanges) {
    lines.push(`- ${range}`);
  }

  lines.push("");
  lines.push("## Remote Work");
  lines.push("");
  lines.push(`- Remote: ${market.remoteWork.remote}`);
  lines.push(`- Hybrid: ${market.remoteWork.hybrid}`);
  lines.push(`- In person: ${market.remoteWork.inPerson}`);
  lines.push(`- Not specified: ${market.remoteWork.notSpecified}`);
  lines.push("");
  lines.push(market.remoteWork.summary);

  lines.push("");
  lines.push("## Market Insights");
  lines.push("");

  for (const insight of market.marketInsights) {
    lines.push(`- ${insight}`);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await fs.writeFile(outputPath, lines.join("\n"), "utf8");

  console.log(`[SAVE] ${outputPath}`);
}

main().catch((error) => {
  console.error("[FATAL]", error instanceof Error ? error.message : error);

  process.exit(1);
});
