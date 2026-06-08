import { readFile } from "node:fs/promises";

const notesPath = "notes.md";

async function main() {
  try {
    console.log(`Reading notes from: ${notesPath}`);

    const notesContent = await readFile(notesPath, "utf-8");

    const payload = {
      notes: notesContent,
      cards: 2,
    };

    console.log("⚡ Sending request to server...");

    const startTime = performance.now();

    const response = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const endTime = performance.now();

    console.log(`Request took ${((endTime - startTime) / 1000).toFixed(2)}s`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    console.log("\nSuccess! Received Structured Data:");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
