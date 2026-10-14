# 課程題庫投稿服務

為 GitHub Pages 題庫提供匿名投稿、題圖儲存、管理者登入與審核發布。前端仍使用原網站格式；正式題庫頁透過公開 API 載入核准的補充題。

- `POST /api/submissions`：匿名送出 1–200 題，固定進入待審核；檢查資料格式與重複題。
- `GET /api/status/:id`：只回傳投稿狀態與給投稿者的說明。
- `GET /api/questions?course=os|algorithms`：只回傳核准題目。
- `/review` 與 `/api/review`：使用 Sites 的 ChatGPT 登入，後端核對管理者帳號。
- 題圖放在 R2；未公開題圖只允許管理者讀取。只保留核准清單中使用的題圖供公開讀取。
- D1 的唯一索引與批次交易防止重複及部分發布；修訂號避免同一投稿被同時處理。

Runtime 設定由 Sites 管理，不能放進 GitHub：`REVIEWER_EMAIL`（管理者登入信箱）、`RATE_HASH_KEY`（匿名投稿頻率雜湊密鑰）。本機驗證使用測試帳號與記憶體資料庫，不寫入正式資料。

修改原網站投稿 UI 或原始題庫後，先在本目錄執行 `node scripts/sync-library.mjs ..`，把前端與現有題目索引同步到服務；同步資料供服務獨立建置，不需要在部署時讀取 GitHub。修改 schema 後執行 `npm run db:generate` 產生新遷移，已套用的遷移不能改寫。

`npm run build` 產生獨立 Worker 與部署資源；`npm test` 驗證匿名投稿、管理者權限、退回、重複攔截、題圖公開權限與頻率限制。部署須同步推送服務來源並使用 Sites 的儲存版本及部署工具，保留 `.openai/hosting.json` 的專案 ID。

登入流程由平台管理，沒有放在前端的管理密碼，也沒有提供首次登入者自動取得管理權限的途徑。
