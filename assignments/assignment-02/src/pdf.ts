import { PDFParse } from "pdf-parse";
import fs from "node:fs/promises";

export async function extractPdfText(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);

    const parser = new PDFParse({
      data: buffer,
    });

    const result = await parser.getText();

    await parser.destroy();

    const text = result.text.trim();

    if (!text) {
      throw new Error("PDF was parsed but no text was extracted.");
    }

    return text;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown PDF parsing error";

    throw new Error(`Failed to parse PDF "${filePath}": ${message}`);
  }
}
