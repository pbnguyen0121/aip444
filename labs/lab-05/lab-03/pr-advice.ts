import dotenv from "dotenv";
import OpenAI from "openai";
import { inspect } from "node:util";
import {
  readGitHubFiles,
  readGitHubFilesTool,
  type GitHubFile,
} from "./tools.ts";

dotenv.config({
  path: "../../../.env",
});

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

if (!process.env.OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY in .env");
  process.exit(1);
}

interface Comment {
  username: string;
  body: string;
  date: string;
}

function parsePrUrl(prUrl: string) {
  const url = new URL(prUrl);

  if (url.origin !== "https://github.com") {
    throw new Error("Not a GitHub URL");
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length !== 4 || parts[2] !== "pull") {
    throw new Error("Invalid Pull Request URL");
  }

  const [owner, repo, , numberText] = parts;
  const number = Number(numberText);

  return {
    owner,
    repo,
    number,
  };
}

async function fetchDiff(prUrl: string): Promise<string> {
  const diffUrl = `${prUrl}.diff`;
  const response = await fetch(diffUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch diff: ${response.status}`);
  }

  let diff = await response.text();

  if (diff.length > 95000) {
    console.warn("Warning: Diff is longer than 95,000 characters. Truncating.");
    diff = diff.slice(0, 95000) + "\n\n...[Diff Truncated]...";
  }

  return diff;
}

async function fetchComments(
  owner: string,
  repo: string,
  issueNum: number,
): Promise<Comment[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}/comments`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "AIP444-Lab-05",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API Error: ${response.status}`);
  }

  const data = await response.json();

  return data.map((item: any) => ({
    username: item.user.login,
    body: item.body,
    date: item.updated_at,
  }));
}

function formatComments(comments: Comment[]): string {
  if (comments.length === 0) {
    return "<thread>\nNo comments found.\n</thread>";
  }

  const formattedComments = comments
    .map(
      (
        comment,
      ) => `<comment username="${comment.username}" date="${comment.date}">
${comment.body}
</comment>`,
    )
    .join("\n\n");

  return `<thread>
${formattedComments}
</thread>`;
}

const systemPrompt = `
You are a Senior Engineer helping a junior developer understand a GitHub Pull Request.

Your tone should be educational, rigorous, and practical. Prioritize correctness, maintainability, safety, and clear reasoning over cleverness.

You will receive:
1. A GitHub PR diff inside a fenced \`\`\`diff code block.
2. A GitHub discussion thread inside <thread> XML tags.
3. The GitHub PR owner, repo, and likely branch/ref.

You have access to a tool named read_github_files.

Tool usage rules:
- Use read_github_files when the diff alone is not enough to understand the surrounding code, imports, package metadata, config files, tests, or related definitions.
- Use it for files that are clearly mentioned in the diff.
- Prefer reading only the most useful 1-3 files.
- Do not fetch every file automatically.
- Do not use the tool if the change is already clear from the diff and comments.
- If the tool returns an error, mention the limitation and continue using the available diff/comments.
- Never invent facts that are not supported by the diff, comments, or fetched file contents.

Follow this reasoning process internally:
1. First, analyze the diff carefully to understand the technical reality of the change.
2. If more context is needed, call read_github_files.
3. Next, analyze the thread to understand the human context, concerns, agreements, disagreements, and reviewer feedback.
4. Next, assess assumptions, constraints, risks, edge cases, implementation quality, and maintainability.
5. Finally, synthesize everything into the final report.

Output a Markdown report with exactly these sections:

## tl;dr
A single-sentence summary of the PR's purpose, max 30 words.

## Stakeholders
A bulleted list of every person who participated, with a one-line description of their stance or contribution.

## Changes
A file-by-file breakdown of what changed and why, written for a junior developer. Mention when full-file context was used.

## Risks
Identify potential bugs, unhandled edge cases, or hidden assumptions. Rate each as Low, Medium, or High severity.

## Learning
Generate 3 Socratic questions only. Do not include answers.
`;

function buildUserPrompt(
  prUrl: string,
  owner: string,
  repo: string,
  diff: string,
  formattedComments: string,
): string {
  return `
Analyze the following GitHub Pull Request.

PR URL:
${prUrl}

Repository:
owner=${owner}
repo=${repo}

When calling read_github_files, use this owner and repo unless the diff clearly refers to another repository.

Code Diff:

\`\`\`diff
${diff}
\`\`\`

Discussion Thread:

${formattedComments}
`;
}

async function askLLMWithTools(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const messages: any[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    const completion = await client.chat.completions.create({
      model: "z-ai/glm-4.7-flash",
      messages,
      tools: [readGitHubFilesTool],
      tool_choice: "auto",
    });

    const assistantMessage = completion.choices[0]?.message;

    if (!assistantMessage) {
      return "No response from model.";
    }

    messages.push(assistantMessage);

    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return assistantMessage.content ?? "";
    }

    for (const toolCall of assistantMessage.tool_calls) {
      console.error(
        `\n[Tool Call - ${toolCall.function.name}]\n`,
        inspect(JSON.parse(toolCall.function.arguments), { colors: true }),
      );

      if (toolCall.function.name !== "read_github_files") {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Error: Unknown tool ${toolCall.function.name}`,
        });
        continue;
      }

      try {
        const args = JSON.parse(toolCall.function.arguments) as {
          files: GitHubFile[];
        };

        const result = await readGitHubFiles(args.files);

        console.error("\n[Tool Result]\n", result.slice(0, 1000));

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Error running read_github_files: ${message}`,
        });
      }
    }
  }

  return "Max tool-call iterations reached before a final answer was produced.";
}

const prUrl = process.argv[2];

if (!prUrl) {
  console.error("Please provide a GitHub PR URL");
  process.exit(1);
}

const result = parsePrUrl(prUrl);
const diff = await fetchDiff(prUrl);
const comments = await fetchComments(result.owner, result.repo, result.number);
const formattedComments = formatComments(comments);

const userPrompt = buildUserPrompt(
  prUrl,
  result.owner,
  result.repo,
  diff,
  formattedComments,
);

const output = await askLLMWithTools(systemPrompt, userPrompt);

console.log("\n===== PR ADVICE REPORT =====\n");
console.log(output);
