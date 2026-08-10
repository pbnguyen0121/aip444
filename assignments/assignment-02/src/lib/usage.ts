import fs from "node:fs/promises";
import path from "node:path";

export interface UsageRecord {
  timestamp: string;
  operation: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
}

const usageDir = path.resolve(process.cwd(), "data/usage");

const usageFile = path.join(usageDir, "llm-usage.jsonl");

export async function logUsage(record: UsageRecord): Promise<void> {
  await fs.mkdir(usageDir, {
    recursive: true,
  });

  await fs.appendFile(usageFile, JSON.stringify(record) + "\n", "utf8");
}
