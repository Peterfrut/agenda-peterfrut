import { execFileSync } from "node:child_process";

const codePrefixes = ["app/", "lib/", "prisma/"];
const docPrefixes = ["docs/", "README.md", "SECURITY.md", "lib/release-notes.ts"];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function changedFiles() {
  const explicitBase = process.env.DOCS_CHECK_BASE?.trim();
  const githubBase = process.env.GITHUB_BASE_REF?.trim();

  if (explicitBase) {
    return git(["diff", "--name-only", `${explicitBase}...HEAD`]);
  }

  if (githubBase) {
    return git(["diff", "--name-only", `origin/${githubBase}...HEAD`]);
  }

  const staged = git(["diff", "--name-only", "--cached"]);
  if (staged) return staged;

  return git(["diff", "--name-only"]);
}

const files = changedFiles()
  .split(/\r?\n/g)
  .map((file) => file.trim().replaceAll("\\", "/"))
  .filter(Boolean);

const hasCodeChange = files.some((file) => codePrefixes.some((prefix) => file.startsWith(prefix)));
const hasDocChange = files.some((file) => docPrefixes.some((prefix) => file === prefix || file.startsWith(prefix)));

if (hasCodeChange && !hasDocChange) {
  console.error("Mudancas em app/lib/prisma detectadas sem atualizacao de documentacao.");
  console.error("Atualize docs/, README/SECURITY ou lib/release-notes.ts antes de finalizar.");
  console.error("Arquivos alterados:");
  for (const file of files) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Documentacao verificada.");
