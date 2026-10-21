import {
  parseBatchInput,
  prepareImport,
  readBatchFiles,
  resolveImportMapping,
} from "./batch-import.mjs?v=batch-recognition-fixes-20261021";

export function setupBatchImport({ document, onApply }) {
  const $ = (id) => document.getElementById(id);
  const formats = {
    text: "文字／Markdown",
    markdown: "Markdown 表格",
    json: "JSON",
    csv: "CSV",
    tsv: "TSV",
    html: "HTML",
  };
  let pending = null;
  let generation = 0;
  let mapping = null;
  function status(text, error = false) {
    $("importStatus").textContent = text;
    $("importStatus").classList.toggle("error", error);
  }
  function close() {
    pending = null;
    $("importPreview").hidden = true;
    $("importList").replaceChildren();
    $("importWarnings").replaceChildren();
    $("importMapping").hidden = true;
    mapping = null;
  }
  function preview(batch, source, original = "") {
    pending = { ...batch, source, original };
    $("importModeField").hidden = source === "paste";
    $("applyImport").textContent =
      source === "paste" ? "使用整理後的文字" : "匯入下方文字區";
    $("importSummary").textContent =
      `共 ${batch.questions.length} 題${batch.questions.some((q) => q.issues.length) ? `・${batch.questions.filter((q) => q.issues.length).length} 題需檢查` : ""}。請核對後再套用至下方文字區。`;
    for (const warning of batch.warnings || []) {
      const item = document.createElement("li");
      item.textContent = warning;
      $("importWarnings").append(item);
    }
    for (const [i, q] of batch.questions.entries()) {
      const item = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${i + 1}. ${q.stem.slice(0, 80) || "缺少題幹"}${q.issues.length ? "（需檢查）" : ""}`;
      const content = document.createElement("p");
      content.textContent = `原題號：${q.number}${q.type ? `・${q.type}` : ""}\n${q.stem}`;
      item.append(summary, content);
      if (q.options.length) {
        const list = document.createElement("ul");
        for (const option of q.options) {
          const li = document.createElement("li");
          li.textContent = `${option.label}. ${option.text}`;
          list.append(li);
        }
        item.append(list);
      }
      if (q.issues.length) {
        item.open = true;
        const warning = document.createElement("p");
        warning.className = "import-warning";
        warning.textContent = q.issues.join(" ");
        item.append(warning);
      }
      $("importList").append(item);
    }
    $("importPreview").hidden = false;
    const sources = batch.files
      .map(
        (file) => `${file.name}（${formats[file.format]}，${file.count} 題）`,
      )
      .join("、");
    status(`已讀取 ${sources}。尚未更動目前文字。`);
    $("importPreviewHeading").focus();
  }
  function showMapping(error, source, original = "") {
    if (!error.mapping) return;
    mapping = { ...error.mapping, source, original };
    $("mappingSource").textContent = mapping.name
      ? error.message
      : `貼上內容：${error.message}`;
    const selects = ["mappingStem", "mappingNumber", "mappingOptions"];
    for (const id of selects) {
      $(id).replaceChildren();
      const empty = document.createElement("option");
      empty.value = "-1";
      empty.textContent = id === "mappingStem" ? "請選擇題幹欄" : "不使用";
      $(id).append(empty);
      mapping.headers.forEach((header, i) => {
        const option = document.createElement("option");
        option.value = String(i);
        const row = mapping.rows[mapping.hasHeader ? 1 : 0];
        const sample = row?.[i];
        option.textContent = `${i + 1}. ${header || "未命名"}｜${(typeof sample === "string" ? sample : JSON.stringify(sample) || "").slice(0, 65)}`;
        $(id).append(option);
      });
    }
    $("mappingHasHeader").checked = mapping.hasHeader;
    $("mappingHeaderField").hidden = mapping.format === "json";
    $("mappingColumns").replaceChildren();
    mapping.headers.forEach((header, i) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = String(i);
      label.append(
        checkbox,
        document.createTextNode(`${i + 1}. ${header || "未命名欄位"}`),
      );
      $("mappingColumns").append(label);
    });
    $("mappingStatus").textContent = "";
    $("importMapping").hidden = false;
    $("mappingHeading").focus();
  }
  $("chooseBatchFiles").addEventListener("click", () =>
    $("batchFiles").click(),
  );
  $("batchFiles").addEventListener("change", async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    const current = ++generation;
    close();
    status("正在讀取題目檔案……");
    $("importTools").setAttribute("aria-busy", "true");
    try {
      const batch = await readBatchFiles(files, { document });
      if (generation === current) preview(batch, "files");
    } catch (error) {
      if (generation === current) {
        status(`無法匯入：${error.message} 目前文字已保留。`, true);
        showMapping(error, "files");
      }
    } finally {
      if (generation === current) $("importTools").removeAttribute("aria-busy");
    }
  });
  $("recognizePaste").addEventListener("click", () => {
    generation++;
    $("importTools").removeAttribute("aria-busy");
    close();
    try {
      const original = $("batchText").value;
      const batch = parseBatchInput(original, { document });
      preview(
        {
          ...batch,
          files: [
            {
              name: "貼上內容",
              format: batch.format,
              count: batch.questions.length,
            },
          ],
        },
        "paste",
        original,
      );
    } catch (error) {
      status(`無法辨識：${error.message} 目前文字已保留。`, true);
      showMapping(error, "paste", $("batchText").value);
    }
  });
  $("applyMapping").addEventListener("click", () => {
    if (!mapping) return;
    try {
      if (
        mapping.source === "paste" &&
        $("batchText").value !== mapping.original
      )
        throw new Error("貼上內容已變更，請重新辨識。");
      const batch = resolveImportMapping(mapping, {
        stem: Number($("mappingStem").value),
        number: Number($("mappingNumber").value),
        options: Number($("mappingOptions").value),
        columns: [...$("mappingColumns").querySelectorAll("input")]
          .filter((input) => input.checked)
          .map((input) => Number(input.value)),
        hasHeader: $("mappingHasHeader").checked,
      });
      const { source, original, name } = mapping;
      close();
      preview(
        {
          ...batch,
          files: [
            {
              name: name || "貼上內容",
              format: batch.format,
              count: batch.questions.length,
            },
          ],
        },
        source,
        original,
      );
    } catch (error) {
      $("mappingStatus").textContent = error.message;
    }
  });
  $("cancelMapping").addEventListener("click", () => {
    generation++;
    close();
    status("已取消欄位對應，目前文字已保留。");
    $("chooseBatchFiles").focus();
  });
  $("cancelImport").addEventListener("click", () => {
    generation++;
    close();
    status("已取消匯入，目前文字已保留。");
    $("chooseBatchFiles").focus();
  });
  $("applyImport").addEventListener("click", () => {
    if (!pending) return;
    try {
      if (
        pending.source === "paste" &&
        $("batchText").value !== pending.original
      )
        throw new Error("貼上內容已變更，請重新按「辨識貼上格式」。");
      const mode =
        pending.source === "paste" ? "replace" : $("importMode").value;
      const result = prepareImport(
        $("batchText").value,
        pending.questions,
        mode,
        { document },
      );
      $("batchText").value = result.text;
      close();
      onApply();
      status(
        `已${mode === "replace" ? "取代為" : "加入"} ${result.added} 題，目前共 ${result.questions.length} 題。${result.renumbered ? `有 ${result.renumbered} 個衝突題號已接續編號。` : ""}請選擇科目與範圍，再按「比對全部題目」。`,
      );
      $("batchText").focus();
    } catch (error) {
      status(`無法套用：${error.message} 目前文字已保留。`, true);
    }
  });
  $("clearInput").addEventListener("click", () => {
    generation++;
    close();
    $("importTools").removeAttribute("aria-busy");
    status("");
  });
  return {
    showError(error) {
      generation++;
      close();
      $("importTools").removeAttribute("aria-busy");
      status(`無法辨識：${error.message} 目前文字已保留。`, true);
      showMapping(error, "paste", $("batchText").value);
    },
  };
}
