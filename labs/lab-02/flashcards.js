const fs = require("node:fs/promises");
const path = require("node:path");
const { parseArgs } = require("node:util");
const OpenAI = require("openai");
const { calculateCost } = require("./cost");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const STUDENT_NAME = "Phuong Bac Nguyen";
const STUDENT_ID = "130135205";

function printHeader() {
  console.log("====================================");
  console.log("AIP444 Lab 2 - ACE Flashcard Generator");
  console.log(`Name: ${STUDENT_NAME}`);
  console.log(`Student ID: ${STUDENT_ID}`);
  console.log(`Run Date: ${new Date().toLocaleString()}`);
  console.log("====================================\n");
}

function parseArguments() {
  const options = {
    cards: {
      type: "string",
      short: "c",
      default: "3",
    },
  };

  let values, positionals;

  try {
    ({ values, positionals } = parseArgs({ options, allowPositionals: true }));
  } catch (err) {
    console.error("Error parsing arguments:", err.message);
    process.exit(1);
  }

  if (positionals.length === 0) {
    console.error("Error: Please provide a path to notes file");
    console.error("Usage: node flashcards.js <notes-path> [--cards N]");
    process.exit(1);
  }

  const notesPath = positionals[0];
  const cards = Number.parseInt(values.cards, 10);

  if (Number.isNaN(cards) || cards < 1 || cards > 5) {
    console.error("Error: --cards must be between 1 and 5");
    process.exit(1);
  }

  return { notesPath, cards };
}

async function getFileContents(filePath, description) {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    console.error(`Error: ${description} not found or cannot be read: ${filePath}`);
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

function validateApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("Error: OPENROUTER_API_KEY is missing.");
    console.error("Please add OPENROUTER_API_KEY=sk-... to your .env file.");
    process.exit(1);
  }

  return apiKey;
}

function buildUserPrompt(notesContent, cards) {
  return `
Generate exactly ${cards} ACE flashcard(s) from the course notes below.

Critical reminders:
- Use only the notes inside <course_notes>.
- Each EVIDENCE field must be a direct quote from the notes.
- Do not hallucinate.
- Expand acronyms in the CHALLENGE field.
- Use student voice for MISCONCEPTION.
- If there is not enough reliable material, return the specified ERROR message.

<course_notes>
${notesContent}
</course_notes>
`;
}

function extractCards(output) {
  const cardRegex = /=== CARD \d+ ===[\s\S]*?(?=(=== CARD \d+ ===|$))/g;
  return output.match(cardRegex);
}

async function main() {
  printHeader();

  const apiKey = validateApiKey();
  const { notesPath, cards } = parseArguments();

  const systemPromptPath = path.join(__dirname, "SYSTEM_PROMPT.md");

  const systemPrompt = await getFileContents(systemPromptPath, "System prompt file");
  const notesContent = await getFileContents(notesPath, "Notes file");

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const userPrompt = buildUserPrompt(notesContent, cards);

  try {
    const completion = await client.chat.completions.create({
      model: "baidu/cobuddy:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const output = completion.choices[0]?.message?.content || "";

    if (output.trim().startsWith("ERROR:")) {
      console.log(output.trim());
      return;
    }

    const extractedCards = extractCards(output);

    if (!extractedCards) {
      console.log("No ACE cards found in model output.");
      console.log("\nRaw output:\n");
      console.log(output);
      process.exit(1);
    }

    console.log(`Generated ${extractedCards.length} flashcard(s):\n`);

    for (const card of extractedCards) {
      console.log(card);
      console.log();
    }

    const cost = await calculateCost(completion);
    console.log("====================================");
    console.log(`Model: ${cost.model}`);
    console.log(`Tokens used: ${cost.tokens.total}`);
    console.log(`Estimated cost: $${cost.total.toFixed(6)}`);
    console.log("====================================");
  } catch (err) {
    console.error("Error calling OpenRouter:");
    console.error(err.message);
    process.exit(1);
  }
}

main();