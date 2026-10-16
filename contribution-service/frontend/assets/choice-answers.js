/* Preserve case-sensitive mathematics while recognizing explicit answer letters. */
((root) => {
  const clean = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .replace(/^[A-H][.、．:：]\s*/i, "")
      .replace(/，/g, ",")
      .replace(/；/g, ";")
      .replace(/\s+/g, "");
  function expectedChoiceKey(answer, options) {
    const raw = String(answer ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/\s*\(依本題庫(?:標準答案|分類)\)$/, "");
    const toIndex = (letter) => {
      const labelled = options
        .map((o, i) =>
          new RegExp("^" + letter + "[.、．:：]\\s*", "i").test(
            String(o).trim(),
          )
            ? i
            : -1,
        )
        .filter((i) => i >= 0);
      return labelled.length === 1 ? labelled[0] : letter.charCodeAt(0) - 65;
    };
    let letters;
    if (/^[A-H](?:\s*[,、，/＋+&及與和]\s*[A-H])*(?:[.、．])?$/i.test(raw))
      letters = raw.match(/[A-H]/gi).map((l) => l.toUpperCase());
    else if (
      /^[A-H][.、．:：]\s*\S/i.test(raw) &&
      !/[、,，;；]\s*[A-H][.、．:：]/i.test(raw)
    )
      letters = [raw[0].toUpperCase()];
    if (letters) {
      const indices = letters.map(toIndex);
      if (
        new Set(indices).size !== indices.length ||
        indices.some((i) => i < 0 || i >= options.length)
      )
        return null;
      return indices
        .sort((a, b) => a - b)
        .map((i) => String.fromCharCode(65 + i))
        .join("");
    }
    const values = options.map(clean),
      value = clean(raw);
    const exact = values
      .map((o, i) => (o === value ? i : -1))
      .filter((i) => i >= 0);
    if (exact.length === 1) return String.fromCharCode(65 + exact[0]);
    if (exact.length > 1) return null;
    const parts = raw
      .split(/[、,，;；]\s*/)
      .map(clean)
      .filter(Boolean);
    const indices = parts.map((part) => {
      const hits = values
        .map((o, i) => (o === part ? i : -1))
        .filter((i) => i >= 0);
      return hits.length === 1 ? hits[0] : null;
    });
    if (
      !indices.length ||
      indices.includes(null) ||
      new Set(indices).size !== indices.length
    )
      return null;
    return indices
      .sort((a, b) => a - b)
      .map((i) => String.fromCharCode(65 + i))
      .join("");
  }
  root.courseChoiceAnswers = { expectedChoiceKey };
})(typeof window === "object" ? window : globalThis);
