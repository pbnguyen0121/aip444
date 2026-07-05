import { dotProduct, embedText, loadDatabase } from "./utils.ts";

async function printTop3(query: string, products: any[]) {
  const [queryEmbedding] = await embedText(query);

  const results = products
    .map((product) => ({
      title: product.title,
      category: product.category,
      score: dotProduct(queryEmbedding, product.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  console.log(`\nQuery: ${query}`);
  results.forEach((r, i) => {
    console.log(`${i + 1}. [${r.score.toFixed(4)}] ${r.title} (${r.category})`);
  });
}

async function main() {
  const products = await loadDatabase();

  await printTop3("Nice smelling scent", products);
  await printTop3("A textbook on quantum physics", products);
}

main().catch(console.error);
