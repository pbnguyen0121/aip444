import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env", quiet: true });

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const REVIEW_MODEL = "nex-agi/nex-n2-pro:free";

function parseArgs(argv) {
  const args = {
    debug: false,
    file: null,
    output: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--debug") {
      args.debug = true;
    } else if (arg === "--file") {
      args.file = argv[i + 1];
      i++;
    } else if (arg === "--output") {
      args.output = argv[i + 1];
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function debugLog(enabled, message) {
  if (enabled) {
    console.error(`[debug] ${message}`);
  }
}

function getTimestampFilename() {
  const now = new Date();

  const pad = (num) => String(num).padStart(2, "0");

  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  return `review-${day}-${month}-${year}-${hour}-${minute}-${second}.html`;
}

function readFileInput(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");

  if (!content.trim()) {
    throw new Error(`File is empty: ${filePath}`);
  }

  return {
    mode: "file",
    path: filePath,
    content,
  };
}

function readGitStagedDiff() {
  let diff = "";

  try {
    diff = execSync("git diff --staged", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      "Could not read staged git diff. Make sure you are inside a git repository.",
    );
  }

  if (!diff.trim()) {
    throw new Error(
      "No staged changes found. Use `git add <file>` first, or use `--file filename`.",
    );
  }

  return {
    mode: "git",
    path: "git diff --staged",
    content: diff,
  };
}

function readFileTool({ file_path, start_line, end_line }) {
  const absolutePath = path.resolve(file_path);

  if (!fs.existsSync(absolutePath)) {
    return `Error: File not found: ${file_path}`;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const lines = content.split("\n");

  const start = start_line ? Math.max(start_line, 1) : 1;
  const end = end_line ? Math.min(end_line, lines.length) : lines.length;

  const selectedLines = lines
    .slice(start - 1, end)
    .map((line, index) => `${start + index}: ${line}`)
    .join("\n");

  const maxChars = 12000;

  if (selectedLines.length > maxChars) {
    return (
      selectedLines.slice(0, maxChars) + "\n\n[TRUNCATED: file output too long]"
    );
  }

  return selectedLines;
}

function ripgrepTool({ search_pattern }) {
  if (!search_pattern || !search_pattern.trim()) {
    return "Error: search_pattern is required.";
  }

  try {
    const result = execSync(
      `rg --line-number --glob "!node_modules/**" --glob "!*.html" --glob "!review.js" ${JSON.stringify(search_pattern)}`,
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      },
    );

    const maxChars = 12000;

    if (result.length > maxChars) {
      return (
        result.slice(0, maxChars) + "\n\n[TRUNCATED: ripgrep output too long]"
      );
    }

    return result || "No matches found.";
  } catch (error) {
    return "No matches found.";
  }
}

function createPlaceholderHtmlReport(input) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AI Code Review Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f7f7f8;
      color: #222;
      padding: 32px;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    h1 {
      margin-top: 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 14px;
      font-weight: bold;
    }
    pre {
      background: #111827;
      color: #e5e7eb;
      padding: 16px;
      border-radius: 12px;
      overflow-x: auto;
      max-height: 420px;
    }
  </style>
</head>
<body>
  <main class="container">
    <h1>AI Code Review Report</h1>
    <p><span class="badge">${input.mode.toUpperCase()} MODE</span></p>
    <p><strong>Reviewed input:</strong> ${escapeHtml(input.path)}</p>
    <p>This is a temporary checkpoint report. The next checkpoint will replace this with real AI reviewer findings.</p>
    <h2>Input Preview</h2>
    <pre>${escapeHtml(input.content.slice(0, 5000))}</pre>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    debugLog(args.debug, "Starting review CLI");
    debugLog(
      args.debug,
      `OpenRouter API key loaded: ${process.env.OPENROUTER_API_KEY ? "yes" : "no"}`,
    );

    const outputFile = args.output || getTimestampFilename();

    let input;

    if (args.file) {
      debugLog(args.debug, `Running in File Mode with file: ${args.file}`);
      input = readFileInput(args.file);
    } else {
      debugLog(args.debug, "Running in Git Mode using git diff --staged");
      input = readGitStagedDiff();
    }

    debugLog(args.debug, `Input mode: ${input.mode}`);
    debugLog(args.debug, `Input length: ${input.content.length} characters`);
    debugLog(args.debug, `Output file: ${outputFile}`);
    debugLog(args.debug, "Starting parallel reviewer phase");

    const [securityFindings, maintainabilityFindings] = await Promise.all([
      runSecurityAuditor(input, args.debug),
      runMaintainabilityCritic(input, args.debug),
    ]);

    debugLog(args.debug, "Parallel reviewer phase completed");

    const html = await runLeadDeveloperJudge(
      input,
      securityFindings,
      maintainabilityFindings,
      args.debug,
    );

    fs.writeFileSync(outputFile, html, "utf8");
    console.log(`Review report saved to: ${outputFile}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function runSecurityAuditor(input, debug) {
  debugLog(debug, "[Security Auditor] Starting review");

  const systemPrompt = `
You are "The Security Auditor".

Persona:
You are paranoid, strict, and precise. You treat every line of code as a possible security risk.

Role:
Review the provided input for:
- hardcoded secrets, API keys, passwords, tokens
- unsafe file access
- missing authentication or authorization checks
- dangerous shell commands
- SQL injection
- XSS
- insecure logging of sensitive data

Important:
You will receive either:
1. a git diff from staged changes, or
2. the full contents of a source code file.

You must return ONLY valid JSON.
Do not include markdown.
Do not include explanations outside JSON.
Do not report style issues.
Do not report maintainability issues.
Do not report speculative issues.

Only report security issues that have strong evidence in the provided code.

Return a JSON array of findings.
Each finding must have:
- path: string
- line: number
- severity: "info" | "warn" | "critical"
- category: "security"
- description: string

If there are no security issues, return [].

Few-shot example:
Input:
const apiKey = "sk-12345-secret";

Output:
[
  {
    "path": "src/example.js",
    "line": 1,
    "severity": "critical",
    "category": "security",
    "description": "A hardcoded API key was found. Move this secret into an environment variable and make sure it is not committed to git."
  }
]

Be grounded. Only report issues that are visible in the provided input.
`;

  let fileContext = input.content;

  if (input.mode === "file") {
    debugLog(debug, `[Security Auditor] Calling read_file("${input.path}")`);

    fileContext = readFileTool({
      file_path: input.path,
    });

    debugLog(
      debug,
      `[Tool read_file] Returned ${fileContext.length} characters`,
    );
  } else {
    debugLog(
      debug,
      "[Security Auditor] Using staged git diff as review context",
    );
  }

  let searchResults = "Tool not used in Git Mode.";

  if (input.mode === "file") {
    debugLog(debug, `[Security Auditor] Calling ripgrep("apiKey")`);

    searchResults = ripgrepTool({
      search_pattern: "apiKey",
    });

    debugLog(
      debug,
      `[Tool ripgrep] Returned ${searchResults.length} characters`,
    );
  }

  const userPrompt = `
Review mode: ${input.mode}
Reviewed path: ${input.path}

Tool: read_file

${fileContext}

Tool: ripgrep("apiKey")

${searchResults}
`;

  const response = await client.chat.completions.create({
    model: REVIEW_MODEL,
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
    temperature: 0,
  });

  const raw = response.choices[0].message.content;

  debugLog(debug, "[Security Auditor] Raw JSON response:");
  if (debug) {
    console.error(raw);
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  if (Array.isArray(parsed)) {
    debugLog(
      debug,
      `[Security Auditor] Finished with ${parsed.length} findings`,
    );
    return parsed;
  }

  if (Array.isArray(parsed.findings)) {
    debugLog(
      debug,
      `[Security Auditor] Finished with ${parsed.findings.length} findings`,
    );
    return parsed.findings;
  }

  return [];
}

async function runMaintainabilityCritic(input, debug) {
  debugLog(debug, "[Maintainability Critic] Starting review");

  const systemPrompt = `
You are "The Maintainability Critic".

Persona:
You are obsessed with clean code, readable names, simple structure, and the DRY principle.

Role:
Review the provided input for:
- unclear variable names
- unused imports
- confusing function names
- functions doing too many things
- missing comments where logic is not obvious
- inconsistent return types
- code that is hard to read or maintain

Important:
You will receive either:
1. a git diff from staged changes, or
2. the full contents of a source code file.

You must return ONLY valid JSON.
Do not include markdown.
Do not include explanations outside JSON.

Return a JSON array of findings.
Each finding must have:
- path: string
- line: number
- severity: "info" | "warn" | "critical"
- category: "maintainability"
- description: string

If there are no maintainability issues, return [].

Few-shot example:
Input:
function total(items) {
  let x = 0;
  for (const item of items) {
    x += item.price;
  }
  return x;
}

Output:
[
  {
    "path": "src/example.js",
    "line": 2,
    "severity": "warn",
    "category": "maintainability",
    "description": "The variable name 'x' is unclear. Rename it to something descriptive like 'totalPrice' so future readers understand its purpose."
  }
]

Be grounded. Only report issues that are visible in the provided input.
Do NOT report security issues. Security issues belong to another reviewer.
`;

  let fileContext = input.content;

  if (input.mode === "file") {
    debugLog(
      debug,
      `[Maintainability Critic] Calling read_file("${input.path}")`,
    );

    fileContext = readFileTool({
      file_path: input.path,
    });

    debugLog(
      debug,
      `[Tool read_file] Returned ${fileContext.length} characters`,
    );
  } else {
    debugLog(
      debug,
      "[Maintainability Critic] Using staged git diff as review context",
    );
  }

  let searchResults = "Tool not used in Git Mode.";

  if (input.mode === "file") {
    debugLog(debug, `[Maintainability Critic] Calling ripgrep("join")`);

    searchResults = ripgrepTool({
      search_pattern: "join",
    });

    debugLog(
      debug,
      `[Tool ripgrep] Returned ${searchResults.length} characters`,
    );
  }

  const userPrompt = `
Review mode: ${input.mode}
Reviewed path: ${input.path}

Tool: read_file

${fileContext}

Tool: ripgrep("join")

${searchResults}
`;

  const response = await client.chat.completions.create({
    model: REVIEW_MODEL,
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
    temperature: 0.2,
  });

  const raw = response.choices[0].message.content;

  debugLog(debug, "[Maintainability Critic] Raw JSON response:");
  if (debug) {
    console.error(raw);
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  if (Array.isArray(parsed)) {
    debugLog(
      debug,
      `[Maintainability Critic] Finished with ${parsed.length} findings`,
    );
    return parsed;
  }

  if (Array.isArray(parsed.findings)) {
    debugLog(
      debug,
      `[Maintainability Critic] Finished with ${parsed.findings.length} findings`,
    );
    return parsed.findings;
  }

  return [];
}

async function runLeadDeveloperJudge(
  input,
  securityFindings,
  maintainabilityFindings,
  debug,
) {
  debugLog(debug, "[Lead Developer] Starting synthesis");

  const systemPrompt = `
You are "The Lead Developer".

Persona:
You are extremely experienced, pragmatic, empathetic, and firm.
You care about helping the developer improve the code without overwhelming them.

Goal:
You receive findings from two AI code reviewers:
1. Security Auditor
2. Maintainability Critic

Your job:
- De-duplicate overlapping findings
- Remove weak or speculative findings
- Keep important findings
- Clarify confusing descriptions
- Prioritize the most important issues
- Produce a beautiful final HTML report

Important:
Return ONLY a complete HTML document.
Do not wrap it in markdown.
Do not explain outside the HTML.

The HTML must:
- Include CSS inside a <style> tag
- Have a clear title
- Show reviewed mode and path
- Include an executive summary
- Group findings by severity
- Include path, line, category, severity, and description
- Include recommended next steps
- Look polished and readable

If there are no findings, create a positive report saying no major issues were found.
`;

  const userPrompt = `
Review mode: ${input.mode}
Reviewed path: ${input.path}

Security Auditor findings:
${JSON.stringify(securityFindings, null, 2)}

Maintainability Critic findings:
${JSON.stringify(maintainabilityFindings, null, 2)}
`;

  const response = await client.chat.completions.create({
    model: REVIEW_MODEL,
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
    temperature: 0.3,
  });

  const html = response.choices[0].message.content;

  debugLog(debug, "[Lead Developer] HTML report generated");

  return html;
}

main();
