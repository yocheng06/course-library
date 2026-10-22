# 維護說明

本文保留題庫更新與網站維護需要的規則。網站使用方式請看 [README](../README.md)，後端 API、儲存與部署設定請看 [投稿服務說明](../contribution-service/README.md)。

## 題庫內容

- 題目保留固定 ID；合併重複題時，保留來源版本、原有解析與舊 ID 對照，讓既有連結及待複習標記仍能對應。
- 來源有答案時設定 `answerProvided: true`；不要因缺圖、選項、解析或題意疑點重新標為待確認。未提供答案的題目保留待確認提示，文字題由讀者自行對照。
- 圖片題的文字題幹依原題轉錄，不改成摘要或自行加入條件；題圖中的程式碼不另抄進題幹。
- 解析需說明理由、計算步驟或適用條件。新來源只有簡短說明時，保留或補強既有完整推導。
- 修正答案時保留修正前答案與查核紀錄；不要自行宣稱沒有依據的「官方接受格式」。

## 批次比對與查重

批次查題每次最多 30 題、80,000 字；投稿每批最多 200 題。兩者用途不同，不應共用輸入上限。

比對需保留數學大小寫、比較方向、取整方式、題圖及填答要求。已核對的語言版本、選項換序與代號差異可對應同題；不能使用一般模糊拼字或忽略附加條件來套答案。

選擇題答案按貼上的選項內容重新對應。缺選項、答案衝突、缺少必要題圖或只有相似題時，應標為需確認。科目或單元選錯時提供切換提示，不把其他範圍已收錄的題目直接當作全站未收錄。

投稿同步失敗時，明示目前只比對內建題庫；不要以不完整資料宣稱全站未收錄。重新編輯或同步後必須再次比對，避免複製舊結果。

## 修改與同步

以下命令均從專案根目錄執行。

作業系統題庫以 `os.html` 中的 `course-manifest` 與每單元 `data-course-unit` JSON 區塊保存。清單中的題數、題目 ID 與舊 ID 對照需和各單元資料一致；`scripts/course-data.mjs` 會在批次索引建置時讀取並驗證這些區塊。頁面只在需要時解析所選單元，全部單元搜尋會載入全部區塊。題庫仍內嵌在頁面中，以保留離線與本機開啟功能。

修改題庫、來源版本或選項對照後，更新批次索引及投稿查重資料：

```sh
node scripts/build-batch-library.mjs
node contribution-service/scripts/sync-library.mjs .
```

投稿前端有兩份檔案：根目錄的 `submit.html`、`review.html` 與 `assets/contributions-*.js`，以及 `contribution-service/frontend/` 的對應檔案。從根目錄修改後，使用上述同步器更新服務副本，並更新實際修改資源的版本參數。

根目錄前端與資料檢查：

```sh
node --test tests/batch-model.test.mjs tests/submission-index.test.mjs tests/frontend-safety.test.mjs
```

投稿服務需先建置，再執行權限與資料流程檢查：

```sh
cd contribution-service
npm run build
npm test
```

單純修改批次頁排版不需發布投稿服務。修改題庫對照或投稿前端後，需同步、檢查並發布對應服務，避免網站查題與投稿查重的版本不同。

GitHub Pages 與 Sites 投稿服務分開發布；更新 GitHub 不代表 Sites 已更新。Sites 的來源、版本及發布流程見投稿服務說明。

## 登入與資料保護

管理者日常使用帳號密碼登入；首次設定或忘記密碼依服務的管理者驗證流程處理。帳密與機密設定不得寫入前端、README 或 GitHub。

登入與設定表單明確使用 POST，等處理程式綁定後才啟用送出按鈕。避免改回瀏覽器預設的 GET，造成帳密出現在網址。

已發布題目可編輯、下架及還原，修改前版本保留紀錄。管理者的完整備份包含題圖連結，不包含圖片原始檔；不要把下載 JSON 當作已備份所有圖片。

本機草稿與收據依瀏覽器保存，清除瀏覽器資料會刪除；重要草稿請另行下載。

## 內容紀錄

- [題庫內容檢視](../content-review.md)：答案修正、解析與參考來源。
- [OS L7 查重紀錄](../content/os-l7-dedup-review.json)：來源題目與合併判斷。
- [合併 ID 對照](../contribution-service/content/merge-map.json)：內建及投稿合併對照。
- [投稿原稿快照](../contribution-service/content/approved-merges.json)：已核對的投稿合併原稿。
- [解析補充資料](../contribution-service/content/approved-explanations.json)：已審閱的解析與查核來源。

題數依網站資料計算，README 不記錄每次改版的暫時數字。

## 課間電台

目前保持停用，舊播放器網址顯示暫停使用與返回首頁。原播放器及媒體檔仍保留。

需要恢復時，將 `assets/music-feature.js` 的 `MUSIC_RADIO_ENABLED` 設為 `true`，更新引用此檔案的頁面版本參數，並確認手機底部空間、播放器與跨課程播放行為。
