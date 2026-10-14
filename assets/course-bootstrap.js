/* Load approved community questions before initializing the existing learning controls. */
(async () => {
  "use strict";
  const course = document.body.dataset.course;
  let failed = false;
  try {
    if (!navigator.onLine) throw new Error("offline");
    const response = await fetch(
      window.courseContributions.apiOrigin + "/api/questions?course=" + course,
      { signal: AbortSignal.timeout(3500) },
    );
    if (!response.ok) throw new Error("unavailable");
    const data = await response.json();
    if (!Array.isArray(data.questions)) throw new Error("invalid");
    const units =
      course === "os"
        ? UNITS
        : JSON.parse(document.getElementById("course-data").textContent);
    for (const entry of data.questions) {
      const unit = units.find((item) => item.id === entry.unit),
        q = entry.question;
      if (!unit || !q || typeof q !== "object") continue;
      const id = course === "os" ? q.id : q.bookmarkId;
      if (
        !/^community-[0-9a-f-]{36}-\d+$/.test(id) ||
        unit.questions.some(
          (item) => (course === "os" ? item.id : item.bookmarkId) === id,
        )
      )
        continue;
      unit.questions.push(q);
    }
    if (course === "algorithms")
      document.getElementById("course-data").textContent =
        JSON.stringify(units);
  } catch {
    failed = true;
  }
  const scripts = [
    course === "os" ? "os-learning.js" : "algorithms-learning.js",
    "learning-tools.js",
    "reading-flow.js",
    "question-viewer.js",
    "music-feature.js",
  ];
  for (const name of scripts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "assets/" + name + "?v=contributions-20261014";
      script.onload = resolve;
      script.onerror = reject;
      document.body.append(script);
    }).catch(() => {
      const message = document.createElement("p");
      message.className = "api-notice";
      message.setAttribute("role", "alert");
      message.textContent = "題庫操作程式未能載入，請重新整理頁面。";
      document.querySelector(".main").prepend(message);
    });
  }
  if (failed && navigator.onLine) {
    const note = document.createElement("p");
    note.className = "api-notice";
    note.setAttribute("role", "status");
    note.textContent = "新增投稿題庫暫時無法同步，目前顯示原有題庫。";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "plain";
    retry.textContent = "重新同步";
    retry.addEventListener("click", () => location.reload());
    note.append(retry);
    document.querySelector(".heading").after(note);
  }
})();
