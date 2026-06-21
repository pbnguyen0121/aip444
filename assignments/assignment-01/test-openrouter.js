import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env", quiet: true });

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY in ../../.env");
  }

  const response = await client.chat.completions.create({
    model: "cohere/north-mini-code:free",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant. Reply briefly.",
      },
      {
        role: "user",
        content: "Say: OpenRouter test passed.",
      },
    ],
    temperature: 0,
  });

  console.log(response.choices[0].message.content);
}

main().catch((error) => {
  console.error("OpenRouter test failed:");
  console.error(error.message);
  process.exit(1);
});
