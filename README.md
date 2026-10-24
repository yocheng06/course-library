# 課程學習站

作業系統與演算法課程題庫，提供分單元閱讀、搜尋、練習作答與答案解析。

**[開啟網站](https://yocheng06.github.io/course-library/)** · [批次查題](https://yocheng06.github.io/course-library/batch.html) · [投稿題目](https://yocheng06.github.io/course-library/submit.html)

## 功能

- 依科目、單元、題型或待複習狀態瀏覽與搜尋題目。
- 練習單選、多選與填空題，檢查答案並閱讀解析。
- 批次查題支援 TXT、Markdown、JSON、CSV／TSV 與 HTML；可預覽比對結果。
- 標記待複習題目，匯出或匯入瀏覽器中的學習設定。
- 投稿新題供管理者審核；核准後才會公開。
- 支援手機閱讀、單元切換、換頁與字級調整。

## 使用方式

1. 從首頁選擇科目與單元。
2. 搜尋或閱讀題目，也可切換練習模式作答。
3. 檢查答案、查看解析，並將需要複習的題目加上標記。

待複習標記、閱讀設定與練習統計保存在目前瀏覽器，不會跨裝置同步。重要資料可從閱讀設定匯出備份。

## 本機開啟與測試

下載完整專案後，以瀏覽器開啟 `index.html` 閱讀內建題庫，並保留 `assets/` 資料夾。批次查題需透過 HTTP／HTTPS 開啟；投稿與審核需連接線上服務。

前端使用 HTML、CSS 與 JavaScript。安裝開發相依套件後，可執行：

```sh
npm ci
npm test
npm run test:all
```

`npm test` 執行前端測試；`npm run test:all` 另建置並測試投稿服務。

## 專案結構

| 路徑 | 說明 |
| --- | --- |
| `index.html` | 課程首頁 |
| `os.html`、`algorithms.html` | 作業系統與演算法題庫 |
| `batch.html` | 批次查題 |
| `submit.html` | 題目投稿 |
| `assets/` | 共用程式、樣式、題庫索引與媒體 |
| `contribution-service/` | 投稿與審核服務 |

## 維護文件

- [網站與題庫維護說明](docs/maintenance.md)
- [投稿服務說明](contribution-service/README.md)
- [題庫內容檢視](content-review.md)
