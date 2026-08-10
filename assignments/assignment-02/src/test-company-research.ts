import fs from "node:fs/promises";
import path from "node:path";

import { jobPostingSchema } from "./schemas/job.js";

import { researchCompany } from "./research-company.js";

async function main() {
  const jobPath = path.resolve(
    process.cwd(),
    "data/jobs/junior-full-stack-developer-co-op-magna-international.json",
  );

  console.log("[TEST] Loading extracted Magna job...");

  const raw = await fs.readFile(jobPath, "utf8");

  const job = jobPostingSchema.parse(JSON.parse(raw));

  console.log("[TEST] Asking LLM to plan company research...");

  const research = await researchCompany(job);

  console.log("\n===== COMPANY RESEARCH =====\n");

  console.log(JSON.stringify(research, null, 2));

  console.log("\n[TEST] Company research PASSED");
}

main().catch((error) => {
  console.error("\n[TEST] Company research FAILED");

  console.error(error);

  process.exit(1);
});
