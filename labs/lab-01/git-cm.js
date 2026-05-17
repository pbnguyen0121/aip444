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
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0") +
    " " +
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0") +
    ":" +
    String(now.getSeconds()).padStart(2, "0");

  console.log(`git-cm: Developed by ${fullName} - ${studentId}`);
  console.log(`Run Date: ${runDate}`);
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

  const completion = await openai.chat.completions.create({
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    messages: [
      {
        role: "system",
        content:
          "You are an LLM running in a CLI tool. You write semantic commit messages based on a git diff. Output ONLY one commit message using Conventional Commits format, for example: feat: add git diff support. Do not use Markdown. Do not explain anything.",
      },
      {
        role: "user",
        content: diff,
      },
    ],  
    temperature: 0.1,
    max_tokens: 200,
  });

  const commitMessage = completion.choices[0]?.message?.content;

  if (!commitMessage) {
    console.log("❌ Error: Model did not return a commit message.");
    console.log(JSON.stringify(completion, null, 2));
    process.exit(1);
  }

  console.log(commitMessage.trim());
}


main();