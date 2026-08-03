import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface SaveTraceOptions {
  sourceUrl: string;
  reportFilename: string;
  finalOutput: unknown;
  runItems: unknown[];
}

export async function saveTrace({
  sourceUrl,
  reportFilename,
  finalOutput,
  runItems,
}: SaveTraceOptions): Promise<string> {
  const tracesDirectory = path.resolve("traces");

  await mkdir(tracesDirectory, {
    recursive: true,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const traceFilename = `${timestamp}-agent-trace.json`;
  const tracePath = path.join(tracesDirectory, traceFilename);

  const traceData = {
    generated_at: new Date().toISOString(),
    source_url: sourceUrl,
    report_filename: reportFilename,
    final_output: finalOutput,
    run_items: runItems,
  };

  await writeFile(tracePath, JSON.stringify(traceData, null, 2), "utf8");

  return tracePath;
}
