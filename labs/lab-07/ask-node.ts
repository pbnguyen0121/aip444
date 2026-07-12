import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  getNodeDocsCollection,
  retrieveChunks,
  rerankChunks,
  openRouter,
  LLM_MODEL,
  metadataString,
  escapeXmlAttribute,
} from "./rag-utils.ts";

async function main(): Promise<void> {
  console.log("Connecting to Chroma...");

  const collection = await getNodeDocsCollection();

  console.log("Connected!\n");

  const rl = readline.createInterface({
    input,
    output,
  });

  const question = await rl.question("Ask Node.js a question: ");

  rl.close();

  if (!question.trim()) {
    throw new Error("Question cannot be empty.");
  }

  console.log("\nRetrieving relevant documentation...");

  const retrievedChunks = await retrieveChunks(collection, question, 25);

  console.log(`Retrieved ${retrievedChunks.length} candidates.`);

  console.log("Reranking candidates...");

  const rerankedChunks = await rerankChunks(question, retrievedChunks, 5);

  if (rerankedChunks.length === 0) {
    console.log("No relevant documentation was found.");
    return;
  }

  const context = rerankedChunks
    .map((chunk, index) => {
      const source = metadataString(chunk.metadata, "source");
      const heading = metadataString(chunk.metadata, "heading");
      const breadcrumb = metadataString(chunk.metadata, "breadcrumb");

      return `
<document
  id="${index + 1}"
  source="${escapeXmlAttribute(source)}"
  heading="${escapeXmlAttribute(heading)}"
  breadcrumb="${escapeXmlAttribute(breadcrumb)}"
>
${chunk.document}
</document>`;
    })
    .join("\n");

  console.log("Generating answer...\n");

  const response = await openRouter.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a helpful Node.js documentation assistant.

Answer the user's question using only the provided documentation context.

Rules:
- Do not invent information.
- If the context does not contain enough information, say so clearly.
- Give a clear and concise explanation.
- Include a short code example when useful.
- Mention the source filename and heading used in the answer.
        `.trim(),
      },
      {
        role: "user",
        content: `
Question:

${question}

Documentation context:

${context}
        `.trim(),
      },
    ],
  });

  const answer = response.choices[0]?.message?.content;

  if (!answer) {
    throw new Error("The language model returned an empty answer.");
  }

  console.log("========== ANSWER ==========\n");
  console.log(answer);

  console.log("\n========== SOURCES ==========\n");

  rerankedChunks.forEach((chunk, index) => {
    console.log(
      `${index + 1}. ${metadataString(chunk.metadata, "source")} - ` +
        `${metadataString(chunk.metadata, "heading")} ` +
        `(score: ${chunk.relevanceScore.toFixed(4)})`,
    );
  });
}

main().catch((error: unknown) => {
  console.error("\nask-node failed.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
