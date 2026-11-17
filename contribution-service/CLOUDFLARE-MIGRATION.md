# 從原投稿服務搬到自己的 Cloudflare

主站仍使用 GitHub Pages。新服務使用自己的 Workers 與 D1，題圖也存入 D1，不啟用 R2 訂閱。管理者使用網站本身的帳號密碼，不依賴 ChatGPT 身分。

## 先保存完整資料

從舊管理頁「管理工具 → 完整備份與檢查 → 建立完整備份（含題圖）」下載 JSON。備份包含題目、歷史、移除狀態、內建題覆寫、投稿紀錄、單元與圖片，不含管理密碼。不要把備份、移植 SQL、題圖匯入包或金鑰提交到 GitHub。

目前已備份並測試 2026-11-17 的資料。切換前若有人新增或改題，須重新匯出最後一份備份，重新還原與核對；不要用新備份覆寫非空資料庫。

## 在自己的帳號建立新資源

1. 登入 Cloudflare，建立專用 D1 資料庫。
2. 將 `wrangler.d1.example.jsonc` 複製為本機 `wrangler.jsonc`，填入自己的資料庫 ID 與 Worker 的正式 HTTPS 網址。同步設定 `vars.PUBLIC_ORIGIN` 與 `build.command` 的網址。
3. 使用官方 Wrangler 登入該帳號。設定 `RATE_HASH_KEY` 隨機秘密與一次性的 `ADMIN_SETUP_CODE`，使用互動式 secret 輸入，不寫入原始碼。

## 準備與驗證移植包

在 `contribution-service` 目錄執行：

```powershell
node scripts/build.mjs
node scripts/prepare-cloudflare-migration.mjs --backup "完整備份.json" --origin https://你的正式服務.workers.dev --storage d1 --out ../artifacts/最後移植包
node scripts/verify-cloudflare-migration.mjs ../artifacts/最後移植包
node --test tests/cloudflare-migration.test.mjs
```

工具會校驗備份及每張圖片、建立 SQL、改寫題圖位置，並在獨立 SQLite 還原核對。它保留題號、答案、版本、已移除狀態與歷史，不會匯入管理者帳密。`database.sql` 含完整 schema，只能套用到**新的空資料庫**；請勿先執行另一輪 schema migrations。

`verify-cloudflare-migration.mjs` 會比較舊站公開題目的 ID、題幹、答案及選項，檢查題圖位元組與私人圖的存取限制，並確認讀取 API 不會重播修改歷史。若舊站在備份後有變動，驗證會停止。

## 還原到 Cloudflare

```powershell
npx wrangler d1 execute DB --remote --file ../artifacts/最後移植包/database.sql
```

`--storage d1` 已把題圖二進位寫進 SQL，匯入後不必另外上傳 R2。工具將大型文字及二進位拆成受限 SQL 區塊，再逐張核對 SHA-256；GitHub 的靜態題圖保留原連結。`image_objects` 保存原儲存 key、圖片 bytes、類型、大小與 SHA-256。公開／私人判斷仍由原 `/api/image/` 路由控制，每張新投稿圖片上限仍為 1 MB。

若日後改用 R2，可選 `wrangler.example.jsonc` 與 `--storage r2`，另依 manifest 上傳題圖；目前正式移植選擇 D1。

```powershell
npx wrangler deploy
```

在新站用一次性設定碼建立管理員密碼，密碼由站主自行輸入。驗證登入、查題、題圖、歷史、可復原刪除與投稿；測試題最後移除。切換前重新核對舊站有無新增內容。

官方 Wrangler OAuth 請求範圍為 `account:read user:read workers:write workers_scripts:write d1:write`；不請求 R2 或付款寫入權限。`workers_scripts:write` 是發布腳本所需的獨立權限，僅有 `workers:write` 不足以完成目前的部署。授權及撤銷均由站主在 Cloudflare 確認。

## 最後才切換主站

```powershell
node scripts/switch-public-service.mjs --origin https://你的正式服務.workers.dev
node scripts/switch-public-service.mjs --origin https://你的正式服務.workers.dev --write --verified
```

先預覽修改清單；確認新服務資料完整再加 `--write --verified`。工具保留來源檔回復副本，主站提交、檢查與發布仍走現有 GitHub 流程。

舊服務網址不能直接搬到 Cloudflare。保留舊站及原備份供核對與回復；新服務穩定後再決定舊站如何處理。

官方參考：[Worker 設定](https://developers.cloudflare.com/workers/wrangler/configuration/)、[D1 匯入](https://developers.cloudflare.com/d1/best-practices/import-export-data/)、[R2 上傳](https://developers.cloudflare.com/r2/objects/upload-objects/)。
