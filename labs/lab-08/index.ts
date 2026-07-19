import dotenv from "dotenv";
import fs from "fs/promises";
import sharp from "sharp";
import OpenAI from "openai";
import { tavily } from "@tavily/core";

dotenv.config({
  path: "../../.env",
});

type ProcessedImage = {
  base64: string;
  originalSize: number;
  processedSize: number;
  base64Size: number;
};

type LookupErrorArguments = {
  query: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(2)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(2)} MB`;
}

async function processImage(imagePath: string): Promise<ProcessedImage> {
  const originalStats = await fs.stat(imagePath);

  const processedBuffer = await sharp(imagePath)
    .rotate()
    .resize(1024, 1024, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 85,
    })
    .toBuffer();

  const base64 = processedBuffer.toString("base64");

  return {
    base64,
    originalSize: originalStats.size,
    processedSize: processedBuffer.length,
    base64Size: Buffer.byteLength(base64, "utf8"),
  };
}

async function testModelConnection(): Promise<void> {
  console.error(`\nTesting model: ${llmModel}`);

  const response = await openai.chat.completions.create({
    model: llmModel,
    messages: [
      {
        role: "user",
        content:
          "Reply with exactly this sentence: OpenRouter connection is working.",
      },
    ],
  });

  const message = response.choices[0]?.message?.content;

  if (!message) {
    throw new Error("The model returned an empty response.");
  }

  console.log(`Model response: ${message}`);
}

async function analyzeImage(base64Image: string): Promise<string> {
  console.error(`\nAnalyzing image with model: ${llmModel}`);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
You are img-debug, a visual debugging assistant.

Analyze screenshots carefully and only report text or problems that are actually visible.

If the screenshot contains a technical error, warning, error code, stack trace,
or unfamiliar debugging message that would benefit from current documentation,
call the lookup_error tool.

Do not call the tool for a normal interface with no visible technical error.

After receiving web search results, provide:
1. What application or environment is visible.
2. The exact visible error or warning.
3. The most likely cause.
4. Clear steps to fix it.
5. A brief note explaining how the search results support the diagnosis.
      `.trim(),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `
Analyze this screenshot as a visual debugger.

Use lookup_error only when the screenshot contains a visible technical error,
warning, error code, stack trace, or unfamiliar debugging message.
          `.trim(),
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`,
          },
        },
      ],
    },
  ];

  const firstResponse = await openai.chat.completions.create({
    model: llmModel,
    messages,
    tools,
    tool_choice: "auto",
  });

  const assistantMessage = firstResponse.choices[0]?.message;

  if (!assistantMessage) {
    throw new Error("The vision model returned no assistant message.");
  }

  messages.push(assistantMessage);

  const toolCalls = assistantMessage.tool_calls;

  if (!toolCalls || toolCalls.length === 0) {
    if (!assistantMessage.content) {
      throw new Error("The vision model returned an empty response.");
    }

    console.error("\nNo Tavily lookup was needed.");
    return assistantMessage.content;
  }

  for (const toolCall of toolCalls) {
    if (
      toolCall.type !== "function" ||
      toolCall.function.name !== "lookup_error"
    ) {
      continue;
    }

    let parsedArguments: LookupErrorArguments;

    try {
      parsedArguments = JSON.parse(
        toolCall.function.arguments,
      ) as LookupErrorArguments;
    } catch {
      throw new Error("The model returned invalid lookup_error arguments.");
    }

    if (
      typeof parsedArguments.query !== "string" ||
      parsedArguments.query.trim() === ""
    ) {
      throw new Error("lookup_error requires a non-empty query.");
    }

    console.error("\nModel requested Tavily lookup.");
    console.error(`Search query: ${parsedArguments.query}`);

    const toolResult = await lookupError(parsedArguments.query);

    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: toolResult,
    });
  }

  const finalResponse = await openai.chat.completions.create({
    model: llmModel,
    messages,
    tools,
  });

  const finalContent = finalResponse.choices[0]?.message?.content;

  if (!finalContent) {
    throw new Error("The model returned an empty final response.");
  }

  return finalContent;
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_error",
      description:
        "Search the web for reliable information about a visible technical error, warning, error code, or unfamiliar debugging message found in the screenshot.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "A concise web search query containing the exact visible error message, relevant technology, and error code when available.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const tavilyApiKey = process.env.TAVILY_API_KEY;

if (!tavilyApiKey) {
  throw new Error("Missing TAVILY_API_KEY in .env");
}

const tavilyClient = tavily({
  apiKey: tavilyApiKey,
});

const llmModel = process.env.LLM_MODEL;

if (!openRouterApiKey) {
  throw new Error("Missing OPENROUTER_API_KEY in .env");
}

if (!llmModel) {
  throw new Error("Missing LLM_MODEL in .env");
}

const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

async function lookupError(query: string): Promise<string> {
  console.error(`\nSearching Tavily...`);
  console.error(`Query: ${query}`);

  const result = await tavilyClient.search(query, {
    maxResults: 3,
    searchDepth: "basic",
  });

  return JSON.stringify(result, null, 2);
}

async function main(): Promise<void> {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.error("Usage: npm start -- <image-path>");
    process.exitCode = 1;
    return;
  }

  try {
    await fs.access(imagePath);

    console.error(`Processing image: ${imagePath}`);

    const processedImage = await processImage(imagePath);

    console.error("\nImage Optimization Stats");
    console.error("------------------------");
    console.error(
      `Original image size: ${formatBytes(processedImage.originalSize)}`,
    );
    console.error(
      `Processed JPEG size: ${formatBytes(processedImage.processedSize)}`,
    );
    console.error(
      `Base64 string size: ${formatBytes(processedImage.base64Size)}`,
    );

    console.log("\nImage processed successfully.");

    const analysis = await analyzeImage(processedImage.base64);

    console.log("\nFinal Debugging Report");
    console.log("----------------------");
    console.log(analysis);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Failed to process image: ${error.message}`);
    } else {
      console.error("Failed to process image.");
    }

    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
