import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  expandLibraryQuestion,
  normalizeStem,
  optionKey,
} from "../assets/batch-model.mjs";
import { COURSE_UNITS } from "../assets/contribution-model.js";
import { parseOSCourseHTML } from "./course-data.mjs";
const root = resolve(import.meta.dirname, ".."),
  entries = [];
const searchAliases = JSON.parse(
  await readFile(resolve(root, "assets/batch-search-aliases.json"), "utf8"),
);
const courses = {};
for (const [course, file] of [
  ["os", "os.html"],
  ["algorithms", "algorithms.html"],
]) {
  const source = await readFile(resolve(root, file), "utf8");
  const units = course === "os"
    ? parseOSCourseHTML(source)
    : JSON.parse(source.match(/<script id="course-data" type="application\/json">(.*?)<\/script>/s)[1]);
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
for (const entry of [...entries])
  if (entry.preferred)
    for (const alias of searchAliases[entry.id] || []) {
      const stem = typeof alias === "string" ? alias : alias?.stem;
      if (typeof stem !== "string" || !stem.trim()) continue;
      entries.push({
        ...entry,
        ...(typeof alias === "object" && alias?.answer && !alias.options
          ? { answer: alias.answer, options: [], choiceKey: null }
          : {}),
        ...(typeof alias === "object" && Array.isArray(alias?.answerAliases)
          ? { answerAliases: alias.answerAliases }
          : {}),
        ...(typeof alias === "object" && Array.isArray(alias.options) ? {optionAliases:null,options:alias.options,answer:alias.answer,choiceKey:globalThis.courseChoiceAnswers.expectedChoiceKey(alias.answer,alias.options)} : {}),
        stem: stem.trim(),
        preferred: false,
      });
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
