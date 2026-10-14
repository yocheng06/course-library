import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
process.stdout.write("Ready for credential JSON on stdin (input hidden).\n");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.includes("\n")) break;
}
const credential = JSON.parse(input).credential;
const env = {
  ...process.env,
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "http.extraHeader",
  GIT_CONFIG_VALUE_0: "Authorization: Bearer " + credential.token,
};
function git(args, authenticated = false) {
  const r = spawnSync("git", args, {
    cwd: process.cwd(),
    env: authenticated ? env : process.env,
    encoding: "utf8",
  });
  if (r.status !== 0)
    throw new Error(
      "Git operation failed: " + args[0] + " (exit " + r.status + "): " + (r.stderr||"").replaceAll(credential.token,"[redacted]"),
    );
  return r.stdout.trim();
}
try {
  readFileSync(".git/HEAD");
} catch {
  git(["init", "-b", credential.branch]);
  git(["config", "user.name", "Codex"]);
  git(["config", "user.email", "codex@users.noreply.github.com"]);
  git(["remote", "add", "origin", credential.remote_url]);
}
git(["add", "."]);
const status = git(["status", "--porcelain"]);
if (status)
  git([
    "commit",
    "-m",
    "Add anonymous question submissions with protected owner review",
  ]);
git(["push", "origin", credential.branch], true);
console.log(JSON.stringify({ commit_sha: git(["rev-parse", "HEAD"]) }));
