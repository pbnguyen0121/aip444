export interface GitHubFile {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

const MAX_LINES = 1000;

function normalizeRef(ref = "main"): string {
  if (ref.startsWith("refs/")) {
    return ref;
  }
  if (/^[a-f0-9]{40}$/i.test(ref)) {
    return ref;
  }
  return `refs/heads/${ref}`;
}

export async function readGitHubFiles(files: GitHubFile[]): Promise<string> {
  const results: string[] = [];
  for (const file of files) {
    const ref = normalizeRef(file.ref ?? "main");
    const rawUrl = `https://raw.githubusercontent.com/${file.owner}/${file.repo}/${ref}/${file.path}`;
    try {
      const response = await fetch(rawUrl, {
        headers: {
          "User-Agent": "AIP444-Lab-05",
        },
      });
      if (!response.ok) {
        results.push(
          `## Error reading ${file.owner}/${file.repo}/${file.path}\n\n` +
            `GitHub returned ${response.status} ${response.statusText}.\n\n` +
            `URL tried: ${rawUrl}`,
        );
        continue;
      }
      const content = await response.text();
      const lines = content.split("\n");
      const totalLines = lines.length;

      let finalContent = content;
      if (totalLines > MAX_LINES) {
        finalContent =
          lines.slice(0, MAX_LINES).join("\n") +
          `\n[File truncated: showing first ${MAX_LINES} of ${totalLines} lines]`;
      }
      results.push(
        `## File: ${file.owner}/${file.repo}/${file.path}\n\n` +
          `Ref: ${file.ref ?? "main"}\n\n` +
          "```text\n" +
          finalContent +
          "\n```",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push(
        `## Error reading ${file.owner}/${file.repo}/${file.path}\n\n${message}`,
      );
    }
  }

  return results.join("\n\n---\n\n");
}

export const readGitHubFilesTool = {
  type: "function" as const,
  function: {
    name: "read_github_files",
    description:
      "Read one or more full source files from GitHub when a PR diff does not provide enough context. Use this for files mentioned in the diff when understanding surrounding code, imports, package metadata, configuration, or related definitions would improve the PR review. Do not use it unnecessarily.",
    parameters: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "A list of GitHub files to read.",
          items: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description:
                  "GitHub repository owner or organization, for example 'microsoft'.",
              },
              repo: {
                type: "string",
                description: "GitHub repository name, for example 'vscode'.",
              },
              path: {
                type: "string",
                description:
                  "File path inside the repository, for example 'package.json'.",
              },
              ref: {
                type: "string",
                description:
                  "Branch, tag, or commit SHA. Defaults to 'main' if omitted.",
              },
            },
            required: ["owner", "repo", "path"],
            additionalProperties: false,
          },
        },
      },
      required: ["files"],
      additionalProperties: false,
    },
  },
};
