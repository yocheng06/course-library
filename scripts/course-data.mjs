const attribute = (source, name) =>
  source.match(new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, "i"))?.[1];

export function parseOSCourseHTML(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const manifestScript = scripts.find(([, attrs]) => attribute(attrs, "id") === "course-manifest");
  if (manifestScript) {
    const manifest = JSON.parse(manifestScript[2]);
    const dataByUnit = new Map(
      scripts
        .map(([, attrs, body]) => [attribute(attrs, "data-course-unit"), body])
        .filter(([id]) => id),
    );
    return manifest.map((unit) => {
      const raw = dataByUnit.get(unit.id);
      if (raw === undefined) throw new Error(`Missing embedded question data for OS unit ${unit.id}.`);
      const questions = JSON.parse(raw);
      if (!Array.isArray(questions) || questions.length !== unit.questionCount)
        throw new Error(`OS unit ${unit.id} question count does not match its manifest.`);
      return {...unit, questions};
    });
  }

  const legacy = html.match(/const UNITS\s*=\s*(\[.*?\]);/s);
  if (legacy) return JSON.parse(legacy[1]);
  throw new Error("Could not find the embedded OS course data.");
}
