import { writeFile } from "fs/promises";
import { embedText, serializeProduct } from "./utils.ts";

function cleanTsv(value: string): string {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\n/g, " ");
}

async function main() {
  console.log("Fetching products...");

  const response = await fetch("https://dummyjson.com/products?limit=200");
  const data = await response.json();
  const products = data.products;

  console.log(`Fetched ${products.length} products`);

  await writeFile("products.json", JSON.stringify(products, null, 2));

  const serializedProducts = products.map(serializeProduct);

  console.log("Creating embeddings...");
  const embeddings = await embedText(serializedProducts);

  const vectorsTsv = embeddings.map((vector) => vector.join("\t")).join("\n");
  await writeFile("vectors.tsv", vectorsTsv);

  const metadataLines = [
    "Title\tCategory",
    ...products.map(
      (p: any) => `${cleanTsv(p.title)}\t${cleanTsv(p.category)}`,
    ),
  ];

  await writeFile("metadata.tsv", metadataLines.join("\n"));

  console.log("Done!");
  console.log("Created: products.json, vectors.tsv, metadata.tsv");
  console.log(`Vector count: ${embeddings.length}`);
  console.log(`Vector dimensions: ${embeddings[0].length}`);
}

main().catch(console.error);
