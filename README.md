# 課程學習站

作業系統與演算法課程題庫，提供分單元閱讀、搜尋、遮答練習、單元測驗與答案解析。

**[開啟網站](https://yocheng06.github.io/course-library/)** · [批次查題](https://yocheng06.github.io/course-library/batch.html) · [投稿題庫](https://course-library-submissions-yocheng06.yocheng06.chatgpt.site/submit.html) · [題庫管理](https://course-library-submissions-yocheng06.yocheng06.chatgpt.site/review.html)

目前版本：**[v1.3.0](https://github.com/yocheng06/course-library/releases/tag/v1.3.0)** · [所有 Releases](https://github.com/yocheng06/course-library/releases) · [本版更新說明](docs/releases/v1.3.0.md)

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

## 使用方式

1. 從首頁選擇科目與單元，閱讀題目或使用搜尋。
2. 切換遮答練習或單元測驗，作答後對照正解與解析。
3. 將需要複習的題目加上標記，或從上次測驗直接重練錯題。

測驗暫存、上次結果、待複習標記與閱讀設定保存在目前瀏覽器，不會跨裝置同步；清除瀏覽器資料會一併移除。可從閱讀設定匯出其支援的學習資料備份。

## 本機使用與開發

下載專案並保留 `assets/`，在專案目錄執行 `python -m http.server 8000`，再開啟 `http://localhost:8000/`。投稿與管理功能使用上方的線上服務入口。

前端使用 HTML、CSS 與 JavaScript；開發時執行 `npm ci` 安裝套件，`npm test` 執行前端測試。網站題庫快照不包含管理帳號或私人修改歷史，最新公開題庫仍以線上同步資料為準。

## 維護文件

- [網站與題庫維護說明](docs/maintenance.md)
- [投稿與管理服務說明](contribution-service/README.md)
- [本次功能整合與驗證紀錄](docs/網站功能整合改良_20261102.md)
