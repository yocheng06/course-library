# 課程學習站

作業系統與演算法課程題庫，提供分單元閱讀、搜尋、遮答練習、單元測驗與答案解析。

**[開啟網站](https://yocheng06.github.io/course-library/)** · [批次查題](https://yocheng06.github.io/course-library/batch.html) · [投稿題庫](https://course-library-submissions-yocheng06.yocheng06.chatgpt.site/submit.html) · [題庫管理](https://course-library-submissions-yocheng06.yocheng06.chatgpt.site/review.html)

最近正式 Release：**[v1.3.0](https://github.com/yocheng06/course-library/releases/tag/v1.3.0)** · [所有 Releases](https://github.com/yocheng06/course-library/releases) · [本版更新說明](docs/releases/v1.3.0.md)

目前進度已更新至 **2026-11-04**；`main` 包含 v1.3.0 之後的更新。先看 [系統架構](docs/architecture.md)、[最新進度與驗證](docs/updates/2026-11-04.md)，或 [v1.3.0 以後的完整提交差異](https://github.com/yocheng06/course-library/compare/v1.3.0...main)。

[測驗、備份與發布檢查改進](docs/improvements-20261104.md)：測驗語言與可調比例、手機篩選、完整備份、版本狀態及發布檢查。

## 主要功能

- 題目依單元、主題分組，同主題依「單選 → 多選 → 填空」排序，可搜尋題目、答案與解析。
- 遮答練習與單元測驗支援選項隨機排列；相依選項保留原序，閱讀模式維持原有選項順序。
- 測驗作答自動暫存，重新整理後可繼續；每科保留最近一次已交卷結果，可查看錯題並直接重練。
- 批次查題支援 TXT、Markdown、JSON、CSV／TSV、HTML；完整符合才顯示已收錄與答案，未收錄可並排核對候選版本。
- 題目與答案 HTML 可配對匯入；自動建議主題，並支援勾選題目整批調整。
- 任何人可投稿及修正題目，修改後立即公開；保留歷史，管理者可還原修改與已移除題目。
- 管理區提供題庫健檢、缺解析與疑似重複清單、題圖連結檢查及版本比較。
- 完整題庫快照與瀏覽器快取可先顯示內容，背景同步最新投稿、修改及下架狀態。
- 支援深色模式、手機閱讀、字級調整、待複習標記及學習設定備份。
- 閱讀與遮答練習可勾選「隱藏英文題目」；只屏蔽純英文題，中英雙語與中文含英文術語的題目保留，來源資料及批次查題不變。
- 考後可自行勾選，將錯題與未答題整批加入待複習；預設不勾選，上次測驗也能使用。取消時只撤回本次新增標記。
- 可清除此單元或本課程待複習，清除前確認，並可復原上次清除；不刪題目或測驗紀錄。
- 管理者可新增單元、改名稱、拖拉排序；保留固定 ID，閱讀、查題與投稿同步使用單元資訊。
- 刪題經伺服器確認後立即更新畫面、題數及本機快取，再背景同步；舊同步結果不會覆蓋這次刪除。
- CPU 排程解析提供計算表與時間線，支援橫向捲軸及「往前／往後」按鈕。

## 使用方式

1. 從首頁選擇科目與單元，閱讀題目或使用搜尋。
2. 切換遮答練習或單元測驗，作答後對照正解與解析。
3. 將需要複習的題目加上標記，或從上次測驗直接重練錯題。

測驗暫存、上次結果、待複習標記與閱讀設定保存在目前瀏覽器，不會跨裝置同步；清除瀏覽器資料會一併移除。可從閱讀設定匯出其支援的學習資料備份。

## 架構總覽

主站是 **GitHub Pages 靜態網站**；投稿與管理則由獨立的 **Cloudflare Worker + D1 + R2** 服務處理。閱讀時先用 GitHub 隨附快照或上次瀏覽器快取，背景再讀公開 API。測驗與待複習保存在瀏覽器，公開題目與修改歷史保存在後端，兩者不同步。

```mermaid
flowchart LR
  U[使用者瀏覽器] --> P["GitHub Pages<br/>閱讀／練習／測驗／批次查題"]
  P --> S[內嵌題庫與公開快照]
  P <--> L["localStorage<br/>測驗／待複習／快取"]
  P --> A["獨立投稿管理服務<br/>Cloudflare Worker"]
  U --> A
  A --> D[("D1<br/>公開題目／版本／單元設定")]
  A --> R[("R2<br/>投稿題圖")]
```

程式模組、資料流、權限與部署邊界見 [系統架構文件](docs/architecture.md)。原始碼不含正式資料庫、管理帳密、瀏覽器私人學習紀錄或全部投稿圖片；複製此 Repository 不會複製線上完整狀態。

## 本機使用與開發

下載專案並保留 `assets/`，在專案目錄執行 `python -m http.server 8000`，再開啟 `http://localhost:8000/`。投稿與管理功能使用上方的線上服務入口。

前端使用 HTML、CSS 與 JavaScript；開發時執行 `npm ci` 安裝套件，`npm test` 執行前端測試。網站題庫快照不包含管理帳號或私人修改歷史，最新公開題庫仍以線上同步資料為準。

## 維護文件

- [系統架構與模組導覽](docs/architecture.md)
- [2026-11-04 進度、功能邊界與驗證](docs/updates/2026-11-04.md)
- [網站與題庫維護說明](docs/maintenance.md)
- [投稿與管理服務說明](contribution-service/README.md)
- [本次功能整合與驗證紀錄](docs/網站功能整合改良_20261102.md)
