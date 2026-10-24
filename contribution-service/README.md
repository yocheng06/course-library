# 課程題庫投稿服務

為課程題庫提供匿名投稿、圖片儲存、管理者審核，以及核准題目的公開 API。

## 功能

- 批次投稿與題目格式驗證，提交時檢查重複題。
- 管理者審核、編輯、下架及恢復題目，並保留修改紀錄。
- 題目圖片存放於 R2；公開題圖僅供核准題目使用。
- 使用 D1 儲存投稿、題目與審核資料。

## API

| 路徑 | 說明 |
| --- | --- |
| `POST /api/submissions` | 提交 1–200 題，回傳投稿編號與處理結果 |
| `GET /api/status/:id` | 查詢投稿狀態 |
| `GET /api/questions?course=os|algorithms` | 取得核准且公開的補充題 |
| `/review` | 管理者登入與審核介面 |
| `/api/manage/questions` | 管理核准題目 |
| `/api/manage/export` | 匯出題目及紀錄 |

## 環境設定

在 Sites 的執行環境設定以下變數，請勿提交至 GitHub：

- `ADMIN_SETUP_CODE`：首次設定管理者帳密的一次性設定碼。
- `REVIEWER_EMAIL`：忘記密碼時用來驗證管理者身分的信箱。
- `RATE_HASH_KEY`：投稿、登入與設定碼頻率限制所用的雜湊密鑰。

服務使用 D1 與 R2。首次設定帳密時，請在 `/review` 輸入設定碼；忘記密碼時，須使用 Sites 綁定的管理者帳號驗證身分。

## 開發

```sh
npm test
npm run build
```

修改資料庫 schema 後，使用 `npm run db:generate` 建立新的遷移；已套用的遷移不可改寫。本機測試使用測試帳號與記憶體資料庫，不會修改正式資料。

若主網站的投稿介面或題庫內容有更新，請先同步資料：

```sh
node scripts/sync-library.mjs ..
```

部署前將服務來源推送至 GitHub，再透過 Sites 儲存並部署版本。保留 `.openai/hosting.json` 中的專案 ID。
