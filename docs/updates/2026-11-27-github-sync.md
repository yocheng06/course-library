# 2026-11-27 GitHub 同步

本次將程式、操作說明、測試及 Cloudflare 最新公開題庫快照一起保存於 GitHub。

- L9「雜湊表／Hash Tables」60 題解析與九主題排序已保存，保留原題與答案。
- 19 題雜湊探測計算可逐步演示線性、二次與雙重雜湊的碰撞與插入，支援往前、往後、重新開始及完成結果。
- 重新讀取兩科公開 API，更新閱讀頁內嵌快照、獨立快照與批次查題資料，包含最新單元英文名稱及既有題目設定。

## 資料與部署位置

| 項目 | 位置 |
| --- | --- |
| 程式、文件與測試 | 此 GitHub 儲存庫 |
| 公開資料快照 | `assets/course-snapshots/os.json`、`assets/course-snapshots/algorithms.json` |
| 閱讀與逐步演示 | `os.html`、`algorithms.html`、`assets/` |
| 批次查題隨附資料 | `assets/batch-library.json` |
| 投稿、管理與 API 原始碼 | `contribution-service/` |
| 正式題目、修改歷史及題圖 | Cloudflare D1 |
| 訪客個人的待複習與測驗紀錄 | 各自的瀏覽器 |

公開快照不等於完整資料庫備份，不包含完整修改歷史、登入資料或私人管理紀錄。憑證、正式環境設定、私人資料庫備份與暫存產物不提交 GitHub。正式部署設定可參考 `contribution-service/wrangler.d1.example.jsonc`。

## 重做同步與驗證

執行 `node scripts/snapshot-public-questions.mjs` 讀取公開資料並重建批次查題資料；接著執行 `node scripts/check-release.mjs`。檢查通過、確認差異後再提交與上傳。

這次操作同步 GitHub，不會另外改寫正式題目或執行 Cloudflare 部署。
