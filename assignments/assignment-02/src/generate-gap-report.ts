import fs from "node:fs/promises";
import path from "node:path";

import { gapAnalysisSchema } from "./schemas/gap-analysis.js";

import { researchGapActions } from "./research-gaps.js";

async function main() {
  const inputPath = path.resolve(
    process.cwd(),
    "data/analysis/gap-analysis.json",
  );

  const outputPath = path.resolve(process.cwd(), "reports/gap-analysis.md");

  const raw = await fs.readFile(inputPath, "utf8");

  const analysis = gapAnalysisSchema.parse(JSON.parse(raw));

  console.log("[INFO] Researching gap recommendations...");

  const research = await researchGapActions(analysis);

  const lines: string[] = [];

  lines.push("# Resume Gap Analysis");
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push(analysis.summary);

  lines.push("");
  lines.push("## Strengths");
  lines.push("");

  for (const item of analysis.strengths) {
    lines.push(`### ${item.strength}`);
    lines.push("");
    lines.push(item.evidence);
    lines.push("");
  }

  lines.push("## Gaps and Recommended Actions");
  lines.push("");

  const levels = [
    "Quick win",
    "Short-term",
    "Medium-term",
    "Long-term",
  ] as const;

  for (const level of levels) {
    const gaps = analysis.gaps.filter((gap) => gap.level === level);

    if (gaps.length === 0) {
      continue;
    }

    lines.push(`### ${level}`);
    lines.push("");

    for (const gap of gaps) {
      lines.push(`#### ${gap.gap}`);
      lines.push("");
      lines.push(`**Why it matters:** ${gap.reason}`);
      lines.push("");
      lines.push(`**Action:** ${gap.action}`);
      lines.push("");

      const evidence = research[gap.gap] ?? [];

      if (evidence.length > 0) {
        lines.push("**Web research:**");
        lines.push("");

        for (const item of evidence) {
          lines.push(`- ${item}`);
        }

        lines.push("");
      }
    }
  }

  lines.push("## Unique Value");
  lines.push("");

  for (const item of analysis.uniqueValue) {
    lines.push(`### ${item.value}`);
    lines.push("");
    lines.push(item.explanation);
    lines.push("");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await fs.writeFile(outputPath, lines.join("\n"), "utf8");

  console.log(`[SAVE] ${outputPath}`);
}

main().catch((error) => {
  console.error("[FATAL]", error instanceof Error ? error.message : error);

  process.exit(1);
});
