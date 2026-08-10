import fs from "node:fs/promises";
import path from "node:path";

import { jobPostingSchema, type JobPosting } from "../schemas/job.js";

export async function loadProcessedJobs(): Promise<JobPosting[]> {
  const jobsDir = path.resolve(process.cwd(), "data/jobs");

  const files = await fs.readdir(jobsDir);

  const jobs: JobPosting[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(jobsDir, file);

    try {
      const raw = await fs.readFile(filePath, "utf8");

      const json = JSON.parse(raw);

      const parsed = jobPostingSchema.safeParse(json);

      // Marker JSON files will fail this schema
      // and are therefore ignored.
      if (parsed.success) {
        jobs.push(parsed.data);
      }
    } catch {
      console.error(`[WARN] Could not read job file: ${file}`);
    }
  }

  return jobs;
}
