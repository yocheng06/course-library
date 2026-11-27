# 題庫讀取保護與官方用量提醒

## 正常使用

閱讀換頁、展開解析、遮答練習與雜湊演示的按鈕在瀏覽器本機執行，不計入伺服器的讀取限制。正常同步維持安靜。短時間異常讀取會回傳 HTTP 429 與 `Retry-After: 60`；不自動永久封鎖，已載入的題庫可繼續使用，冷卻期間前端不反覆重新同步。

正式環境使用 Cloudflare Rate Limiting bindings：有訪客代號的瀏覽器每分鐘最多 60 次整份題庫／頁面讀取，其他資源每分鐘 600 次；共用 IP 使用每分鐘 6,000 次的寬鬆總上限。沒有訪客 cookie 時採共用網路的備援身分及較寬鬆的 600 次上限。限制發生在 Worker 內，先於 D1 查詢，不建立逐次請求的資料庫計數。

Cloudflare 的限制計數為近似值，且依機房分開，不是跨全球的嚴格總額限制。攻擊者更換網路或身分仍可能繞過部分限制；已被拒絕的請求也可能計入 Workers 用量。這項功能不能保證防止所有爬蟲、內容複製或免費額度耗盡。

## 減少資料庫讀取並保留即時更新

`library_revisions` 每科只保存一筆版本計數。資料庫觸發器會在公開題目、內建題修改或單元設定異動時，同一交易內更新版本。這也涵蓋直接 SQL 修改、移動科目及恢復題目。

每次公開 API 請求仍會核對最新版本。版本相同時，重用同節點已序列化的公開回應；條件式同步可回傳 304。組裝資料期間若遇到其他人修改，會重新讀取，不能把不同版本的內容標上舊版本號。快取只保存已完成的純資料，不跨請求共用 D1／網路請求 Promise。

既有訪客封鎖檢查在快取前執行。新增版本計數會讓每次題庫寫入多更新一列，以換取反覆讀取時不必重新掃描整個題庫。版本計數為衍生資料，不能取代完整題目與歷史備份。

## 管理者用量提醒

管理者登入及「版本與同步狀態」重新檢查時，會讀取管理者專用的 `/api/manage/traffic`。正常用量不在題庫主頁顯示；接近門檻時在管理頁提醒。沒有電子郵件、推播或背景常駐通知。

需在 Worker 設定：

- `CF_USAGE_ACCOUNT_ID`：Cloudflare 帳號 ID。
- `CF_USAGE_API_TOKEN`：限該帳號的 Account Analytics Read 唯讀金鑰，以 Secret 保存。不要放入 GitHub、一般前端欄位或對話。
- `CF_USAGE_PLAN`：依實際方案填 `free` 或 `paid`。未指定時不套用免費額度百分比。

資料來自 Cloudflare 官方 GraphQL Analytics，統計帳號內全部 Workers 與全部 D1，而非只看這一個網站。免費方案以每日 Workers 100,000 次請求、D1 5,000,000 列讀取與 100,000 列寫入為參考；80% 起提醒，95% 起加強警示。UTC 每日零點重設，相當於台灣時間上午 8 點。付費方案不套用免費門檻。

分析資料可能延遲或採樣，並非精確帳單保證。成功結果最多快取五分鐘，失敗結果快取一分鐘，跨 UTC 日期或變更設定後重新取得；不會用舊一天的數字當今天用量。未設定權限、網路失敗或資料不完整時會明確顯示未知，絕不以 0 取代。

## 發布步驟

先完成完整 D1 備份，再於原部署設定保留現有資源、Secret 與排程，執行 `node scripts/configure-traffic-bindings.mjs contribution-service/wrangler.jsonc` 加入三個限制綁定。範例使用獨立的 namespace ID；若帳號已有同編號，需改用未使用的編號。

正式更新前套用 `contribution-service/drizzle/0009_library_revisions.sql`，只增加版本表與觸發器，不修改原題。既有部署及由備份還原時，執行階段也會檢查並補齊衍生結構。完成正式環境檢查後再部署。

官方用量金鑰由站主自行在 Cloudflare Secret 欄位輸入。不配置這組唯讀金鑰也能使用讀取限制與版本快取，但官方額度提醒會顯示尚未啟用。

## 驗證

`tests/library-delivery.test.mjs` 檢查快取命中、直接 SQL 異動、跨科移動、競態、共用網路、冷卻、官方用量錯誤及設定保留。服務權限測試另檢查用量僅管理者可讀、封鎖先於快取，以及 429 在查資料庫之前回傳。

官方參考：[Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)、[D1 分析資料](https://developers.cloudflare.com/d1/observability/metrics-analytics/)、[Workers 分析查詢](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[D1 用量](https://developers.cloudflare.com/d1/platform/pricing/)。
