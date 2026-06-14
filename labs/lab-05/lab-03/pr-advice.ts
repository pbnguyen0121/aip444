import dotenv from "dotenv";
import OpenAI from "openai";

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
    console.warn(
      "Warning: Diff is longer than 95,000 characters. Truncating...",
    );
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
      "User-Agent": "AIP444-Lab-03",
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

    Follow this reasoning process internally:
    1. First, analyze the diff carefully to understand the technical reality of the change.
    2. Next, analyze the thread to understand the human context, concerns, agreements, disagreements, and reviewer feedback.
    3. Next, assess assumptions, constraints, risks, edge cases, implementation quality, and maintainability.
    4. Finally, synthesize everything into the final report.

    Do not invent facts that are not supported by the diff or comments. If something is unclear, say so.

    Output a Markdown report with exactly these sections:

    ## tl;dr
    A single-sentence summary of the PR's purpose, max 30 words.

    ## Stakeholders
    A bulleted list of every person who participated, with a one-line description of their stance or contribution.

    ## Changes
    A file-by-file breakdown of what changed and why, written for a junior developer.

    ## Risks
    Identify potential bugs, unhandled edge cases, or hidden assumptions. Rate each as Low, Medium, or High severity.

    ## Learning
    Generate 3 Socratic questions only. Do not include answers.
`;

function buildUserPrompt(
  prUrl: string,
  diff: string,
  formattedComments: string,
): string {
  return `
    Analyze the following GitHub Pull Request.

    PR URL:
    ${prUrl}

    Code Diff:

    \`\`\`diff
    ${diff}
    \`\`\`

    Discussion Thread:

    ${formattedComments}
    `;
}

async function askLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "google/gemma-4-31b-it:free",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  return completion.choices[0]?.message?.content ?? "";
}

const prUrl = process.argv[2];

if (!prUrl) {
  console.error("Please provide a GitHub PR URL");
  process.exit(1);
}

const result = parsePrUrl(prUrl);
//console.log(result);
const diff = await fetchDiff(prUrl);
//console.log(diff.slice(0, 500));

const comments = await fetchComments(result.owner, result.repo, result.number);
const formattedComments = formatComments(comments);

const userPrompt = buildUserPrompt(prUrl, diff, formattedComments);
const output = await askLLM(systemPrompt, userPrompt);

console.log("\n===== PR ADVICE REPORT =====\n");
console.log(output);
