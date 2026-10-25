import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { questionKey, COURSE_UNITS } from "../worker/model.js";
const root = resolve(import.meta.dirname, ".."),
  library = resolve(root, "frontend");
await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(resolve(root, "dist/server"), { recursive: true });
await mkdir(resolve(root, "dist/.openai"), { recursive: true });
const entries = JSON.parse(
  await readFile(resolve(root, "existing-questions.json"), "utf8"),
);
const fingerprints = entries.map((q) =>
  createHash("sha256")
    .update(questionKey(q.course, q.unit, q))
    .digest("hex"),
);
const reviewed = JSON.parse(
  await readFile(resolve(root, "content/approved-explanations.json"), "utf8"),
);
const explanations = {};
for (const entry of reviewed.entries) {
  if (
    !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(entry.id) ||
    explanations[entry.id] ||
    !COURSE_UNITS[entry.course]?.units[entry.unit] ||
    typeof entry.stem !== "string" ||
    !Array.isArray(entry.options) ||
    typeof entry.answer !== "string" ||
    !entry.answer.trim() ||
    typeof entry.explanation !== "string" ||
    !entry.explanation.trim() ||
    entry.explanation.length > 16000 ||
    !entry.sources?.length ||
    entry.sources.some((key) => !reviewed.sources[key])
  ) {
    throw new Error("Invalid reviewed explanation: " + entry.id);
  }
  explanations[entry.id] = {
    course: entry.course,
    unit: entry.unit,
    key: questionKey(entry.course, entry.unit, entry),
    answer: entry.answer,
    explanation: entry.explanation,
  };
}
const merges = JSON.parse(
  await readFile(resolve(root, "content/approved-merges.json"), "utf8"),
).entries;
const mergeCatalog = {};
for (const item of merges) {
  if (
    mergeCatalog[item.id] ||
    !/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(item.id) ||
    item.data.id !== item.id ||
    !entries.some(
      (q) =>
        q.course === item.course &&
        q.unit === item.unit &&
        q.canonicalId === item.canonicalId,
    )
  )
    throw new Error("Invalid reviewed merge: " + item.id);
  mergeCatalog[item.id] = {
    course: item.course,
    unit: item.unit,
    target: item.canonicalId,
    snapshot: createHash("sha256")
      .update(JSON.stringify(item.data))
      .digest("hex"),
  };
}
const paths = [
  "submit.html",
  "review.html",
  "assets/contributions.css",
  "assets/ui-consistency.css",
  "assets/contributions-config.js",
  "assets/contribution-model.js",
  "assets/choice-answers.js",
  "assets/contributions-ui.js",
  "assets/contributions-submit.js",
  "assets/grouped-submissions.mjs",
  "assets/corrections-review.mjs",
  "assets/learning-enhancements.css",
  "assets/submission-inbox-ui.mjs",
  "assets/submission-inbox.mjs",
  "assets/contributions-review.js",
];
const assets = {};
for (const path of paths) {
  const body = await readFile(resolve(library, path), "utf8");
  assets["/" + path] = {
    body,
    type: path.endsWith(".html")
      ? "text/html;charset=utf-8"
      : path.endsWith(".css")
        ? "text/css;charset=utf-8"
        : "text/javascript;charset=utf-8",
  };
}
assets["/assets/icons/course-mascot.png"] = {
  body: (
    await readFile(resolve(root, "frontend/assets/icons/course-mascot.png"))
  ).toString("base64"),
  type: "image/png",
  base64: true,
};
let worker = await readFile(resolve(root, "worker/index.js"), "utf8");
const model = (await readFile(resolve(root, "worker/model.js"), "utf8"))
  .replace(/^import .*;\s*$/gm, "")
  .replace(/^export /gm, "");
worker = worker.replace(
  /^import\s+\{[^}]*\}\s+from\s+["']\.\/model\.js["'];\s*/,
  "",
);
worker =
  (await readFile(resolve(root, "worker/choice-answers.js"), "utf8")) +
  "\n" +
  model +
  "\n" +
  worker.replace(
    "/* BUILD_DATA */",
    `const BASE_FINGERPRINTS=${JSON.stringify(fingerprints)};\nconst BASE_QUESTIONS=${JSON.stringify(entries)};\nconst STATIC_ASSETS=${JSON.stringify(assets)};\nconst REVIEWED_MERGES=${JSON.stringify(mergeCatalog)};\nconst MERGE_VERSION=${JSON.stringify(createHash("sha256").update(JSON.stringify(mergeCatalog)).digest("hex"))};\nconst REVIEWED_EXPLANATIONS=${JSON.stringify(explanations)};\nconst REVIEWED_CONTENT_VERSION=${JSON.stringify(createHash("sha256").update(JSON.stringify(explanations)).digest("hex"))};`,
  );
await writeFile(resolve(root, "dist/server/index.js"), worker);
await cp(
  resolve(root, ".openai/hosting.json"),
  resolve(root, "dist/.openai/hosting.json"),
);
await cp(resolve(root, "drizzle"), resolve(root, "dist/drizzle"), {
  recursive: true,
});
const built = await import(pathToFileURL(resolve(root, "dist/server/index.js")).href);
if (typeof built.default?.fetch !== "function")
  throw new Error("Invalid Worker export");
console.log(
  `Built Worker with ${fingerprints.length} existing-question fingerprints and ${paths.length} UI assets.`,
);
