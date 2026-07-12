import fs from "node:fs/promises";
import path from "node:path";
import { chunkMarkdown, type Chunk } from "./chunker.ts";
import { getNodeDocsCollection } from "./rag-utils.ts";

const DOCS_DIRECTORY = path.resolve("docs");
const BATCH_SIZE = 50;

async function upsertInBatches(
  collection: Awaited<ReturnType<typeof getNodeDocsCollection>>,
  chunks: Chunk[],
): Promise<void> {
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);

    await collection.upsert({
      ids: batch.map((chunk) => chunk.id),
      documents: batch.map((chunk) => chunk.content),
      metadatas: batch.map((chunk) => chunk.metadata),
    });

    const completed = Math.min(start + batch.length, chunks.length);

    console.log(`  Indexed ${completed}/${chunks.length} chunks`);
  }
}

async function main(): Promise<void> {
  console.log("Connecting to Chroma...");

  const collection = await getNodeDocsCollection();

  console.log(`Connected to collection: ${collection.name}`);
  console.log(`Reading documentation from: ${DOCS_DIRECTORY}`);

  const entries = await fs.readdir(DOCS_DIRECTORY, {
    withFileTypes: true,
  });

  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  if (markdownFiles.length === 0) {
    throw new Error(
      `No Markdown files found in ${DOCS_DIRECTORY}. ` +
        "Copy the Node.js API .md files into docs/ first.",
    );
  }

  console.log(`Found ${markdownFiles.length} Markdown files.`);

  let totalChunks = 0;

  for (const filename of markdownFiles) {
    const filePath = path.join(DOCS_DIRECTORY, filename);

    console.log(`\nProcessing ${filename}...`);

    const markdown = await fs.readFile(filePath, "utf8");
    const chunks = chunkMarkdown(markdown, filename);

    if (chunks.length === 0) {
      console.log("  No usable chunks. Skipping.");
      continue;
    }

    console.log(`  Created ${chunks.length} chunks.`);

    await upsertInBatches(collection, chunks);

    totalChunks += chunks.length;
  }

  const collectionCount = await collection.count();

  console.log("\n========================================");
  console.log("Indexing complete!");
  console.log(`Chunks processed this run: ${totalChunks}`);
  console.log(`Records in collection: ${collectionCount}`);
  console.log("========================================");
}

main().catch((error: unknown) => {
  console.error("\nIndexer failed.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
