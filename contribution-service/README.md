# 課程題庫投稿與管理服務

更新日期：2026-11-04。此目錄保存獨立服務的原始碼；整體資料流見 [系統架構](../docs/architecture.md)。

服務為 GitHub Pages 主站提供公開題庫 API、匿名投稿／編輯、可復原刪除、管理者歷史與還原、單元設定、健檢與題圖讀取。**目前新投稿通過檢查後立即公開，不必先經站主核准。** 舊待審核與勘誤端點保留作為相容功能。

## 程式與儲存

| 位置 | 功能 |
| --- | --- |
| `worker/index.js` | 路由、認證、投稿、圖片、公開 API 及內容更新 |
| `worker/model.js` | 題目資料格式、單元、查重與正規化 |
| `worker/builtin-management.js` | 內建題覆寫與單元設定 |
| `worker/library-management.js` | 統一管理清單與明細 |
| `frontend/` | 投稿資產及服務自身的管理頁 |
| `db/schema.js`、`drizzle/` | D1 schema 與 SQL 遷移 |
| `scripts/build.mjs` | 產生獨立 Worker 與部署資產 |
| `scripts/sync-library.mjs` | 從主站同步共用前端、題庫與索引 |
| `content/` | 已核對解析補充、合併資料與來源記錄 |

D1 保存投稿、公開題目、修改歷史、內建題覆寫、單元設定與管理狀態。R2 保存投稿題圖。正式資料不在原始碼 Repository 裡；管理匯出 JSON 含圖片連結，不包含完整圖片二進位內容。

## API 與權限

| API | 行為 |
| --- | --- |
| `GET /api/questions?course=os|algorithms` | 公開題目、覆寫、別名與單元資訊；支援 ETag／304 |
| `GET /api/units?course=os|algorithms` | 公開單元目錄，包含已設定的空單元 |
| `POST /api/submissions` | 匿名投稿，每批 1–200 題；新題立即公開，完整重複略過，不同版本可帶狀態另收錄 |
| `GET /api/status/:id` | 投稿狀態與給投稿者的說明 |
| `GET/POST /api/community/questions/:id` | 公開投稿題讀取、修改及可復原刪除 |
| `GET/POST /api/community/builtin-questions/:course/:id` | 公開內建題讀取、覆寫及可復原刪除 |
| `/api/session`、`/api/login`、`/api/logout`、`/api/password/setup` | 管理者登入與設定流程 |
| `GET /api/manage/library`、`/api/manage/library/item`、`/api/manage/imports` | 需登入；統一列表、單題與匯入批次明細 |
| `GET/POST /api/manage/units` | 需登入；單元新增、名稱／順序設定，保留設定歷史 |
| `GET /api/manage/health` | 需登入；題庫健檢 |
| `/api/manage/questions`、`/api/manage/builtin-questions` 及各自單題／歷史子路徑 | 需登入；編輯、歷史、還原與移除 |
| `GET /api/manage/export` | 需登入；完整管理資料匯出，不含帳密與圖片二進位 |
| `GET /api/image/...` | 依發布狀態與權限提供題圖 |

寫入會檢查來源、格式、答案對應與修訂號；內建題也檢查來源雜湊，避免覆寫較新資料。匿名使用者不能直接還原已刪題；站主可在管理區還原。程式內的舊 `pending` 預設與歷史審核資料不表示新投稿一律等待審核。

匿名投稿不再使用「同 IP 每小時 20 次操作」的舊限制；登入與初始設定仍限制嘗試，相關雜湊狀態仍有用途。

## 匯入、查重與可重試寫入

- 答案必須對應現有選項；單選只能有一個正確答案，多選可有一個或多個答案，保留數學大小寫與原文。
- 查重比對會處理題號前綴、填空表示法與已核對的雙語／選項版本；不改寫原題文字。
- 題圖以實際圖片內容指紋等資訊辨識，不把不同圖題視為相同；不任意從外部 HTTPS 位址抓取圖片。
- 分組投稿可提供 UUID `clientRequestId`，相同 ID 與正規化內容重試回傳原收據；同 ID 不同內容會拒絕。
- 完整重複略過；疑似重複與版本差異保留給管理者比較，不自動覆蓋既有答案。
- 單元新增與名稱／順序修改不更換既有 ID，閱讀、查題及投稿使用公開目錄更新。

## 本機建置與驗證

由 Repository 根目錄執行：

```sh
npm ci
npm run sync:questions
npm --prefix contribution-service ci
npm --prefix contribution-service run build
npm --prefix contribution-service test
```

`sync:questions` 會重建批次索引及同步服務所需資料，需檢查 diff；主站 `node tests/submission-index.test.mjs` 可檢查索引對照。管理頁 `frontend/review.html` 為服務自行維護，不能以主站導向頁覆蓋。

測試使用本機模擬／測試資料，不操作正式題庫。修改 schema 後用 `npm run db:generate` 產生新遷移，不改寫已套用遷移。`0007_unit_settings.sql` 保存單元設定與歷史；既有資料表的內容補充與 schema 遷移分開處理。

`content/approved-explanations.json` 與 `approved-merges.json` 的內容更新可重入，檢查題目 ID、來源內容與更新狀態後才套用，保留修改前歷史，避免覆寫日後的人工修改。

## 設定與部署

Runtime 設定由 Sites 管理，不寫進 GitHub：`ADMIN_SETUP_CODE`、`REVIEWER_EMAIL`、`RATE_HASH_KEY`。管理密碼使用唯一鹽值與 PBKDF2 雜湊；登入使用 HttpOnly、Secure、SameSite cookie。一次性設定碼使用後會記錄失效。

服務使用 Cloudflare Worker、D1 `DB`、R2 `BUCKET`；保留 `.openai/hosting.json` 的原有 project ID。發布需將服務來源推送、建置封裝，經 Sites 儲存版本再部署。**推送 GitHub main 只更新主站 Pages，不會自動更新這個獨立 Worker。**

不要提交設定碼、密碼、Cookie、權杖、正式 DB、使用者私人備份或 node_modules／dist。GitHub 原始碼封存不是正式題庫與題圖的完整備份。
