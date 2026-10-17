import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
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
const { choiceAliases, choiceCombinations, questionStemVersions } =
  await import(pathToFileURL(resolve(library, "assets/batch-model.mjs")).href);
const entries = new Map();
let displayedQuestions = 0;
for (const [course, units] of [
  ["os", os],
  ["algorithms", algo],
])
  for (const unit of units)
    for (const q of unit.questions) {
      displayedQuestions++;
      const inherited =
        choiceAliases(q.options ?? q.opts ?? [], q.optionTranslations) || [];
      const variants = [q, ...(q.sourceVariants || [])];
      for (const variant of variants) {
        const entry = {
          course,
          unit: unit.id,
          stem: variant.stem ?? variant.q,
          options: variant.options ?? variant.opts ?? [],
          canonicalId: q.id ?? q.bookmarkId,
          images: variant.images || [],
        };
        entry.imageKeys = await Promise.all(
          entry.images.map(async (image) => {
            const src = typeof image === "string" ? image : image.src;
            if (!src.startsWith("assets/") || src.includes("..")) return src;
            return (
              "sha256:" +
              createHash("sha256")
                .update(await readFile(resolve(library, src)))
                .digest("hex")
            );
          }),
        );
        const aliases = choiceAliases(
          entry.options,
          variant.optionTranslations,
          inherited,
        );
        for (const stem of questionStemVersions(
          entry.stem,
          variant.translation,
        ))
          for (const options of choiceCombinations(entry.options, aliases)) {
            const version = { ...entry, stem, options };
            entries.set(questionKey(course, unit.id, version), version);
          }
      }
    }
await writeFile(
  resolve(root, "existing-questions.json"),
  JSON.stringify([...entries.values()]),
);
console.log(
  `Synchronized ${displayedQuestions} displayed questions and ${entries.size} known source variants.`,
);
