import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { choiceCombinations } from "../assets/batch-model.mjs";
import { questionKey } from "../assets/contribution-model.js";
test("submission index contains every verified bilingual and mixed-language option set searchable in the batch library", async () => {
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
  for (const e of batch.entries.filter(
    (e) => e.optionAliases && !e.needsImage,
  )) {
    ids.add(e.id);
    for (const options of choiceCombinations(e.options, e.optionAliases)) {
      assert(
        keys.has(
          questionKey(e.course, e.unit, { stem: e.stem, options, images: [] }),
        ),
        e.id + ": missing mixed-language submission duplicate key",
      );
      checked++;
    }
  }
  assert(ids.size >= 43);
  assert(checked > 500);
});
