import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  getNodeDocsCollection,
  retrieveChunks,
  rerankChunks,
  metadataString,
} from "./rag-utils.ts";

async function main() {
  console.log("Connecting to Chroma...");

  const collection = await getNodeDocsCollection();

  console.log("Connected!\n");

  const rl = readline.createInterface({
    input,
    output,
  });

  const query = await rl.question("Ask a question: ");

  rl.close();

  console.log("\nSearching...\n");

  const retrieved = await retrieveChunks(collection, query, 10);

  const reranked = await rerankChunks(query, retrieved, 5);

  console.log("========== RESULTS ==========\n");

  reranked.forEach((chunk) => {
    console.log(`Rank: ${chunk.rerankRank}`);
    console.log(`Score: ${chunk.relevanceScore.toFixed(4)}`);
    console.log(`Source: ${metadataString(chunk.metadata, "source")}`);
    console.log(`Heading: ${metadataString(chunk.metadata, "heading")}`);

    console.log("\n-------------------------");

    console.log(chunk.document);

    console.log("\n===========================\n");
  });
}

main().catch(console.error);
