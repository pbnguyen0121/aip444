import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SaveReportResult {
  status: "report_saved";
  filename: string;
  path: string;
}

export async function saveReport(
  filename: string,
  content: string,
): Promise<SaveReportResult> {
  const trimmedFilename = filename.trim();
  const trimmedContent = content.trim();

  if (!trimmedFilename) {
    throw new Error("Report filename cannot be empty.");
  }

  if (!trimmedContent) {
    throw new Error("Report content cannot be empty.");
  }

  const safeFilename = path.basename(trimmedFilename);

  const markdownFilename = safeFilename.endsWith(".md")
    ? safeFilename
    : `${safeFilename}.md`;

  const reportsDirectory = path.resolve("reports");
  const reportPath = path.join(reportsDirectory, markdownFilename);

  await mkdir(reportsDirectory, {
    recursive: true,
  });

  await writeFile(reportPath, `${trimmedContent}\n`, "utf8");

  return {
    status: "report_saved",
    filename: markdownFilename,
    path: reportPath,
  };
}
