import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { loadDatabase, searchProducts } from "./utils.ts";

const MIN_SIMILARITY_SCORE = 0.25;

async function main() {
  const products = await loadDatabase();

  console.log(`Loaded ${products.length} products`);

  const rl = readline.createInterface({ input, output });

  while (true) {
    const query = await rl.question("\nWhat are you looking for? ");

    if (query.trim().toLowerCase() === "exit") {
      break;
    }

    const results = await searchProducts(query, products, MIN_SIMILARITY_SCORE);

    if (results.length === 0) {
      console.log("I'm sorry, we don't have anything like that in stock.");
      continue;
    }

    console.log(`\nFound ${results.length} matches:`);

    results.forEach((product, index) => {
      console.log(
        `${index + 1}. [Rerank: ${product.rerankScore.toFixed(4)} | Vector: ${product.vectorScore.toFixed(4)}] ${product.title} - $${product.price}`,
      );
    });
  }

  rl.close();
}

main().catch(console.error);
