import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expandLibraryQuestion,
  normalizeStem,
  optionKey,
} from "../assets/batch-model.mjs";
import { COURSE_UNITS } from "../assets/contribution-model.js";
const root = resolve(import.meta.dirname, ".."),
  entries = [];
const courses = {};
for (const [course, file, pattern] of [
  ["os", "os.html", /const UNITS\s*=\s*(\[.*?\]);/s],
  [
    "algorithms",
    "algorithms.html",
    /<script id="course-data" type="application\/json">(.*?)<\/script>/s,
  ],
]) {
  const units = JSON.parse(
    (await readFile(resolve(root, file), "utf8")).match(pattern)[1],
  );
  courses[course] = {
    units: units.map((u) => ({
      id: u.id,
      name: COURSE_UNITS[course].units[u.id] || u.label || u.title || u.id,
    })),
    count: units.reduce((sum, u) => sum + u.questions.length, 0),
  };
  for (const unit of units)
    for (const q of unit.questions)
      entries.push(...expandLibraryQuestion(course, unit.id, q));
}
const unique = new Map();
for (const entry of entries) {
  const key = JSON.stringify([
    entry.course,
    entry.unit,
    entry.id,
    normalizeStem(entry.stem),
    entry.options.map(optionKey),
    entry.choiceKey || entry.answer,
    entry.needsImage,
    entry.optionAliases?.map((group) => group.map(optionKey).sort()) || null,
    entry.conditions || [],
  ]);
  const old = unique.get(key);
  if (!old || entry.preferred) unique.set(key, entry);
}
const payload = { schemaVersion: 1, courses, entries: [...unique.values()] };
await writeFile(
  resolve(root, "assets/batch-library.json"),
  JSON.stringify(payload) + "\n",
);
console.log(
  `Built batch library: ${Object.values(courses).reduce((n, c) => n + c.count, 0)} questions, ${unique.size} searchable versions.`,
);
