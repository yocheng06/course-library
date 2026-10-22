import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { choiceCombinations } from "../assets/batch-model.mjs";
import { questionKey } from "../assets/contribution-model.js";
import { parseOSCourseHTML } from "../scripts/course-data.mjs";
test("submission index contains every text source, reviewed alias and mixed-language option set searchable in the batch library", async () => {
  const batch = JSON.parse(
    await readFile(
      new URL("../assets/batch-library.json", import.meta.url),
      "utf8",
    ),
  );
  const submissions = JSON.parse(
    await readFile(
      new URL(
        "../contribution-service/existing-questions.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const keys = new Set(
    submissions.map((q) => questionKey(q.course, q.unit, q)),
  );
  let checked = 0;
  const ids = new Set();
  for (const e of batch.entries.filter((e) => !e.needsImage)) {
    ids.add(e.id);
    for (const options of choiceCombinations(e.options, e.optionAliases)) {
      assert(
        keys.has(
          questionKey(e.course, e.unit, { stem: e.stem, options, images: [] }),
        ),
        e.id + ": missing searchable submission duplicate key: " + e.stem,
      );
      checked++;
    }
  }
  assert(ids.size >= 800, "coverage must include the whole text question bank");
  assert(checked > batch.entries.length);
});

test("submission index covers current canonical IDs and preserves image bytes and changed option content", async () => {
  const [osHTML, algorithmsHTML, source] = await Promise.all([
    readFile(new URL("../os.html", import.meta.url), "utf8"),
    readFile(new URL("../algorithms.html", import.meta.url), "utf8"),
    readFile(new URL("../contribution-service/existing-questions.json", import.meta.url), "utf8"),
  ]);
  const entries = JSON.parse(source);
  const keys = new Set(entries.map((q) => questionKey(q.course, q.unit, q)));
  const canonical = new Set(entries.map((q) => JSON.stringify([q.course, q.unit, q.canonicalId])));
  const algorithmUnits = JSON.parse(algorithmsHTML.match(/<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  let images = 0;
  for (const [course, units] of [["os", parseOSCourseHTML(osHTML)], ["algorithms", algorithmUnits]]) {
    for (const unit of units) for (const q of unit.questions) {
      const id = q.id ?? q.bookmarkId;
      assert(canonical.has(JSON.stringify([course, unit.id, id])), id + ": canonical ID missing from submission index");
      const imageKeys = await Promise.all((q.images || []).map(async (image) => {
        const src = typeof image === "string" ? image : image.src;
        if (!src.startsWith("assets/") || src.includes("..")) return src;
        images++;
        return "sha256:" + createHash("sha256").update(await readFile(new URL("../" + src, import.meta.url))).digest("hex");
      }));
      assert(keys.has(questionKey(course, unit.id, { ...q, imageKeys })), id + ": current canonical content missing from submission index");
      const options = q.options ?? q.opts ?? [];
      if (options.length) {
        assert(!keys.has(questionKey(course, unit.id, {
          ...q, imageKeys,
          options: options.map((option, index) => index === 0 ? option + "【未核對的新選項版本】" : option),
        })), id + ": changed option must not inherit a duplicate key");
      }
    }
  }
  assert(images > 0, "image fingerprint coverage must be exercised");
});
