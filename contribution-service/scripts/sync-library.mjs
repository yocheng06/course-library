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
  "assets/choice-answers.js",
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
await cp(
  resolve(library, "assets/choice-answers.js"),
  resolve(root, "worker/choice-answers.js"),
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
// Keep all reviewed source variants in the index, so a removed translation or
// option order cannot be reintroduced as a new L7 question.
const { questionKey } = await import("../worker/model.js");
const entries = new Map();
let displayedQuestions = 0;
for (const [course, units] of [
  ["os", os],
  ["algorithms", algo],
])
  for (const unit of units)
    for (const q of unit.questions) {
      displayedQuestions++;
      const variants =
        unit.id === "synchronization" ? [q, ...(q.sourceVariants || [])] : [q];
      for (const variant of variants) {
        const entry = {
          course,
          unit: unit.id,
          stem: variant.stem ?? variant.q,
          options: variant.options ?? variant.opts ?? [],
          ...(unit.id === "synchronization" ? { canonicalId: q.id } : {}),
        };
        entries.set(questionKey(course, unit.id, entry), entry);
      }
    }
await writeFile(
  resolve(root, "existing-questions.json"),
  JSON.stringify([...entries.values()]),
);
console.log(
  `Synchronized ${displayedQuestions} displayed questions and ${entries.size} known source variants.`,
);
