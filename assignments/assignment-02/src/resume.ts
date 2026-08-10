import fs from "node:fs/promises";
import path from "node:path";

import { extractPdfText } from "./pdf.js";

import { extractResume } from "./extract-resume.js";

async function main() {
  const resumePath = path.resolve(process.cwd(), "input/resume/resume.pdf");

  const outputPath = path.resolve(process.cwd(), "data/resume/resume.json");

  console.log("[INFO] Reading resume PDF...");

  try {
    await fs.access(resumePath);
  } catch {
    throw new Error(`Resume not found: ${resumePath}`);
  }

  const text = await extractPdfText(resumePath);

  if (!text.trim()) {
    throw new Error("Resume PDF contained no extractable text.");
  }

  console.log(`[INFO] Extracted ${text.length} characters.`);

  console.log("[INFO] Extracting structured resume...");

  const resume = await extractResume(text);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await fs.writeFile(outputPath, JSON.stringify(resume, null, 2), "utf8");

  console.log(`[SAVE] ${outputPath}`);

  console.log("\n===== RESUME SUMMARY =====");

  console.log(`Name: ${resume.name ?? "Not listed"}`);

  console.log(`Education entries: ${resume.education.length}`);

  console.log(`Work experiences: ${resume.workExperience.length}`);

  console.log(`Skills: ${resume.skills.length}`);

  console.log(`Projects: ${resume.projects.length}`);

  console.log(`Certifications: ${resume.certifications.length}`);
}

main().catch((error) => {
  console.error("[FATAL]", error instanceof Error ? error.message : error);

  process.exit(1);
});
