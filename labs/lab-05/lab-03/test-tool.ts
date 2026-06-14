import { readGitHubFiles } from "./tools.ts";

async function main() {
  console.log("Testing read_github_files...\n");

  const content = await readGitHubFiles([
    {
      owner: "microsoft",
      repo: "vscode",
      path: "package.json",
      ref: "main",
    },
  ]);

  console.log(content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
