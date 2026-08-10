import { webSearch } from "./tools/web-search.js";

async function main() {
  console.log("[TEST] Testing Tavily company research...");

  const result = await webSearch(
    "Magna International company size industry recent news",
    5,
  );

  console.log(`\nQuery: ${result.query}`);
  console.log(`Results returned: ${result.results.length}`);

  for (const [index, item] of result.results.entries()) {
    console.log(`\n--- Result ${index + 1} ---`);
    console.log(`Title: ${item.title}`);
    console.log(`URL: ${item.url}`);
    console.log(`Content: ${item.content.slice(0, 300)}...`);
    console.log(`Score: ${item.score}`);
  }

  if (result.results.length === 0) {
    throw new Error("Tavily returned no search results.");
  }

  console.log("\n[TEST] Tavily search PASSED");
}

main().catch((error) => {
  console.error("\n[TEST] Tavily search FAILED");
  console.error(error);
  process.exit(1);
});
