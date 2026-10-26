import { readInbox, writeInbox, INBOX_KEY } from "./submission-inbox.mjs?v=draft-transfer-20261020";
export function setupSubmissionInbox({ document, storage, courses, addQuestion, download, message, onStorage }) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let items = [];
  function update(id, change) {
    const latest = readInbox(storage), index = latest.findIndex(q => q.id === id);
    if (index === -1) throw new Error("此題已在其他頁面完成或移除，請重新整理待補清單。");
    latest[index] = { ...latest[index], ...change };
    writeInbox(storage, latest);
    items = latest;
    return latest[index];
  }
  function render() {
    try {
      items = readInbox(storage);
      $("pendingDrafts").hidden = !items.length;
      $("pendingCount").textContent = `${items.length} 題待補`;
      $("pendingList").innerHTML = items.map((q, i) => `<details class="draft-card" ${i === 0 ? "open" : ""}>
        <summary>${esc(courses[q.course].name)}・原第 ${esc(q.number)} 題：${esc(q.stem.slice(0, 90))}</summary>
        <form data-pending-id="${esc(q.id)}">
          <div class="field-grid"><label>單元<select name="unit" required><option value="">請選擇單元</option>${q.unit && !Object.hasOwn(courses[q.course].units,q.unit)?`<option value="${esc(q.unit)}" selected>${esc(q.unit)} · 新單元</option>`:''}${Object.entries(courses[q.course].units).map(([id, name]) => `<option value="${esc(id)}" ${q.unit === id ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>
          <label>分類<input name="category" value="${esc(q.category)}" maxlength="100" required placeholder="例如：CPU 排程"></label>
          <label>題型<select name="type">${["單選題", "多選題", "填空題", "圖片題"].map(t => `<option value="${t}" ${q.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
          <label>題目<textarea name="stem" rows="3" required maxlength="10000">${esc(q.stem)}</textarea></label>
          <label>選項（依序為 A、B、C…；一行一個，不用加代號）<textarea name="optionsText" rows="4" maxlength="16000">${esc(q.optionsText)}</textarea></label>
          <label>答案<textarea name="answer" rows="2" maxlength="4000" required placeholder="選擇題填 A 或 A、B；填空題填完整答案">${esc(q.answer)}</textarea></label>
          <label>解析<textarea name="explanation" rows="3" maxlength="16000" required placeholder="說明答案的理由及成立條件">${esc(q.explanation)}</textarea></label>
          <p class="muted">請確認單選／多選題型。圖片題或未列出的新單元，可改用下方「新增一題」填寫後再移除此草稿。</p>
          <div class="actions"><button class="button secondary" type="submit">補齊並加入投稿清單</button><button class="text-button" type="button" data-discard="${esc(q.id)}">移除此待補草稿</button></div>
        </form></details>`).join("");
      for (const form of $("pendingList").querySelectorAll("form[data-pending-id]")) {
        const q = items.find(item => item.id === form.dataset.pendingId);
        for (const field of form.querySelectorAll("[name]")) field.value = q[field.name];
      }
    } catch (error) {
      $("pendingDrafts").hidden = false;
      $("pendingCount").textContent = "讀取失敗";
      $("pendingList").textContent = error.message;
      message(error.message, true);
    }
  }
  $("pendingList").addEventListener("input", event => {
    const form = event.target.closest("form[data-pending-id]");
    if (!form || !event.target.name) return;
    try {
      const patch = { [event.target.name]: event.target.value };
      if (event.target.name === "unit" && !form.elements.category.value.trim()) {
        patch.category = courses[items.find(q => q.id === form.dataset.pendingId).course].units[event.target.value] || "";
        form.elements.category.value = patch.category;
      }
      update(form.dataset.pendingId, patch);
      $("pendingStatus").textContent = "待補內容已暫存於這台裝置。";
    } catch (error) { message(`未能保存待補內容：${error.message}。請下載備份或保留此頁。`, true); }
  });
  $("pendingList").addEventListener("submit", event => {
    const form = event.target.closest("form[data-pending-id]");
    if (!form) return;
    event.preventDefault();
    try {
      const fields = Object.fromEntries([...form.querySelectorAll("[name]")].map(node => [node.name, node.value]));
      const q = update(form.dataset.pendingId, fields);
      if (!q.answer.trim() || !q.explanation.trim()) throw new Error("請補齊答案與解析，再加入投稿清單。");
      // The parent validates course/unit, choices and the existing submission draft.
      addQuestion(q);
      const latest = readInbox(storage).filter(item => item.id !== q.id);
      try { writeInbox(storage, latest); } catch {
        throw new Error("題目已加入投稿清單，但待補清單未能更新；重新加入時會略過重複題。請下載草稿備份。");
      }
      render();
      $("pendingStatus").textContent = `原第 ${q.number} 題已加入投稿清單。`;
      message(`原第 ${q.number} 題已加入投稿清單，預覽後可送出審核。`);
      ($( "pendingList").querySelector("summary") || $("draftHeading")).focus();
    } catch (error) { message(error.message, true); }
  });
  $("pendingList").addEventListener("click", event => {
    const button = event.target.closest("[data-discard]");
    if (!button) return;
    try {
      writeInbox(storage, readInbox(storage).filter(q => q.id !== button.dataset.discard));
      render();
      message("已移除此待補草稿。");
    } catch (error) { message(error.message, true); }
  });
  $("downloadPending").addEventListener("click", () => {
    try {
      // Include visible edits even when a storage write has failed.
      const latest = readInbox(storage);
      for (const form of $("pendingList").querySelectorAll("form[data-pending-id]")) {
        const q = latest.find(item => item.id === form.dataset.pendingId);
        if (q) for (const field of form.querySelectorAll("[name]")) q[field.name] = field.value;
      }
      download({ version: 1, items: latest }, "待補投稿草稿.json");
    }
    catch (error) {
      try { download({ raw: storage.getItem(INBOX_KEY) }, "待補草稿原始資料備份.json"); }
      catch { message(`無法下載備份：${error.message}`, true); }
    }
  });
  $("restorePending").addEventListener("click", () => $("pendingFile").click());
  $("pendingFile").addEventListener("change", async event => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("備份最多 8 MB。");
      const raw = await file.text();
      const restored = readInbox({ getItem: () => raw });
      const latest = readInbox(storage), ids = new Set(latest.map(q => q.id));
      let count = 0;
      for (const q of restored) if (!ids.has(q.id)) { latest.push(q); ids.add(q.id); count++; }
      writeInbox(storage, latest);
      render();
      message(`已載入 ${count} 題待補草稿，原有草稿已保留。`);
    } catch (error) { message(`無法載入待補備份：${error.message}`, true); }
    finally { input.value = ""; }
  });
  onStorage?.(event => { if (event.key === INBOX_KEY) render(); });
  render();
  return { render };
}
