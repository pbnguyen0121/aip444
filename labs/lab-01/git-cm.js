const OpenAI = require("openai");
const { exec } = require("child_process");
const util = require("util");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const execAsync = util.promisify(exec);

function printHeader() {
  const fullName = "Phuong Bac Nguyen";
  const studentId = "130135205";

  const now = new Date();

  const runDate =
    now.getUTCFullYear() +
    "-" +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getUTCDate()).padStart(2, "0") +
    " " +
    String(now.getUTCHours()).padStart(2, "0") +
    ":" +
    String(now.getUTCMinutes()).padStart(2, "0") +
    ":" +
    String(now.getUTCSeconds()).padStart(2, "0");

  console.log(`git-cm: Developed by ${fullName} - ${studentId}`);
  console.log(`Run Date: ${runDate} UTC`);
  console.log("--------------------------------------------------------------");
}

async function main() {
  printHeader();

  const isCreative = process.argv.includes("--creative");

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.log("❌ Error: OPENROUTER_API_KEY not found");
    process.exit(1);
  }

  let diff = "";

  try {
    const result = await execAsync("git diff --staged");
    diff = result.stdout.trim();
  } catch (error) {
    console.log("❌ Not a git repo.");
    process.exit(1);
  }

  if (!diff) {
    console.log("❌ No staged changes found");
    process.exit(1);
  }

  console.log(`✅ Diff found: ${diff.length} characters`);

  const systemPrompt = isCreative
    ? "You are a pirate programmer from the 17th century. Write ONLY one funny git commit message using pirate slang and Gitmoji. Example: 🏴‍☠️ feat: hoist the mighty git diff spyglass, matey! No explanation. No markdown."
    : "You write git commit messages. Output ONLY one Conventional Commit message in this exact format: type: description. Example: feat: add git diff support. Include a space after the colon. No markdown. No explanation.";

  const temperature = isCreative ? 1.8 : 0.1;

  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "poolside/laguna-m.1:free",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: diff,
        },
      ],
      temperature: temperature,
      max_tokens: 300,
    });

    // Some reasoning models return content in reasoning instead of content
    const commitMessage =
      completion.choices[0]?.message?.content ||
      completion.choices[0]?.message?.reasoning;

    if (!commitMessage) {
      console.log("❌ Error: Model did not return a commit message.");
      console.log(JSON.stringify(completion, null, 2));
      process.exit(1);
    }

    // If reasoning text is returned, try extracting the last meaningful line
    const cleanedMessage = commitMessage
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .pop();

    console.log(cleanedMessage.trim());
  } catch (error) {
    if (error.status === 429) {
      console.log("❌ Error: Model is rate-limited. Try again later.");
    } else {
      console.log("❌ OpenRouter Error:", error.message);
    }

    process.exit(1);
  }
}

//test and commit for creative mode

main();