import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  library = resolve(process.argv[2] || dirname(root));
const paths = [
  "submit.html",
  "review.html",
  "assets/contributions.css",
  "assets/contributions-config.js",
  "assets/contribution-model.js",
  "assets/contributions-ui.js",
  "assets/contributions-submit.js",
  "assets/contributions-review.js",
  "assets/icons/course-mascot.png",
];
for (const name of paths) {
  await mkdir(dirname(resolve(root, "frontend", name)), { recursive: true });
  await cp(resolve(library, name), resolve(root, "frontend", name));
}
await cp(
  resolve(library, "assets/contribution-model.js"),
  resolve(root, "worker/model.js"),
);
const os = JSON.parse(
    (await readFile(resolve(library, "os.html"), "utf8")).match(
      /const UNITS\s*=\s*(\[.*?\]);/s,
    )[1],
  ),
  algo = JSON.parse(
    (await readFile(resolve(library, "algorithms.html"), "utf8")).match(
      /<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1],
  );
const entries = [];
for (const [course, units] of [
  ["os", os],
  ["algorithms", algo],
])
  for (const unit of units)
    for (const q of unit.questions)
      entries.push({
        course,
        unit: unit.id,
        stem: q.stem ?? q.q,
        options: q.options ?? q.opts ?? [],
      });
await writeFile(
  resolve(root, "existing-questions.json"),
  JSON.stringify(entries),
);
console.log("Synchronized UI and existing-question index.");
