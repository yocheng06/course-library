# 題庫內容檢視與修正

目前規則：使用者已提供題庫答案的題目視為正常；下方待確認與暫停判分的記錄屬歷史檢視，不代表目前的題目狀態。

## 2026-10-16：作業系統 L7 程序同步查重

- 來源為 `OS_L7_Updated (2).html` 的 13 回、390 筆題目。合併選項換序後有 217 組；再逐組核對翻譯、措辭及正確答案內容，整理為 137 題（單選 54、多選 41、填空 42）。共合併 253 筆來源紀錄。
- 相同主題或相同答案不直接視為重複；不同題型、實質選項不同或問題條件不同的版本保留。例如 Readers-Writers 的另一組選項包含 Banker's Algorithm，保留為不同題；Semaphore 的 block 等待佇列與鏈結佇列填空也分開保留。
- 中英文同題逐項對齊選項語意，逐一驗證正確答案內容一致；依代表版本顯示答案代號。中文題目可讀取原英文題幹與對齊的英文選項。
- 全部 390 筆來源對應均保留在 `sourceRecords`；舊 322 個題目版本保存在 `sourceVariants`，舊 ID 保存在 `aliases`，題目連結及待複習標記可遷移。
- 原有五個作業系統單元與演算法資料保持原內容。查重索引同時保留合併前來源版本，避免已合併的中英文或換序題再次投稿。
- 修正一處原解析中固定的 B、C、D 提示，改為說明 Test-and-Set、Compare-and-Swap 與 Mutex 的關係，避免選項換序後代號與答案矛盾；來源原文仍保存在版本資料。
- [逐組查重對應](content/os-l7-dedup-review.json)列出每題合併的原始筆次、舊 ID 及來源題幹。

日期：2026-10-08

## 範圍與結果

檢視現有 550 題（作業系統 370、演算法 180）的題幹、答案與解析。這次重寫或補強 252 題解析：作業系統 131 題、演算法 121 題；修正 12 題的答案、措辭或數學表示。題數、題目順序、穩定 ID、題幹與原選項均保留，既有待複習標記與題目連結仍可使用。

有完整條件時，解析用定義、推導或反例說明；涉及實作差異時補上版本或平台。需要原題、分類範圍或其他條件的 50 題，明列疑點或缺少的資料，暫停自動判分。這不代表這 50 題全部答錯，也不代表其餘題目已得到學校確認。

「待確認」篩選目前有作業系統 35 題、演算法 56 題：除了上述 50 題，還涵蓋原資料未附選項及既有核對提醒。

## 後續用詞校訂與閱讀調整

本次另校訂 69 題解析（作業系統 63、演算法 6），包括「隻有／隻存在」的錯字，以及「程式設計師、資料、變數、介面、呼叫、排程、預設、實作」等用詞的一致性。這是對現有解析的後續整理，不與先前補強的 252 題直接相加。

其中 25 題改為「核心觀念」「判讀步驟／解題步驟」「適用條件」三段，涵蓋較長解析，以及 OpenMP、implicit threading 等容易混淆的內容。保留題意疑點與適用版本，不改動題幹、選項、答案、題序與穩定 ID。

搜尋結果現在標示命中區域；遮答模式不因搜尋而顯示解析內容。手機版縮短標題與工具區，將篩選入口和模式切換排在同列；重複的範圍說明僅保留供輔助科技讀取。

檢查涵蓋兩科的遮答搜尋、多關鍵字命中、320px／390px 手機與 1280px 桌面畫面，以及大字模式與設定的 Escape 操作。所查看畫面未見水平溢出或 JavaScript 頁面錯誤；550 題資料只調整解析及相關名詞文字。

## 修正原則

- 已能推導或明確辨識的錯誤，更新目前答案，保留 `originalAnswer`，畫面可展開查看修正前答案。
- 題意不能唯一判斷時保留來源答案並標明待確認，不以它自動判定對錯。
- 文字題的數學意思與學校輸入格式分開說明，不將格式提示充當解析。
- 參考連結集中保留在本文件，題目畫面不顯示參考資料區塊。參考來源為相關教材或官方文件；本站推導與反例以自己的文字呈現。來源宣稱的 LMS 判分未經本站登入學校系統核實。

## 12 題答案或表示法調整

| 題目 | 修正前 | 目前答案 |
| --- | --- | --- |
| [作業系統 basics 第 9 題](https://yocheng06.github.io/course-library/os.html?question=basics-9) | B、C | A、B、C、D |
| [作業系統 basics 第 29 題](https://yocheng06.github.io/course-library/os.html?question=basics-29) | A、B | A. Mode bit |
| [作業系統 architecture 第 31 題](https://yocheng06.github.io/course-library/os.html?question=architecture-31) | A、B、C | A、B |
| [作業系統 process 第 11 題](https://yocheng06.github.io/course-library/os.html?question=process-11) | process control block | task control block |
| [作業系統 process 第 12 題](https://yocheng06.github.io/course-library/os.html?question=process-12) | process control block | task control block |
| [作業系統 threads 第 18 題](https://yocheng06.github.io/course-library/os.html?question=threads-018) | A、B、C、D | D. Two-level（題幹仍需確認） |
| [作業系統 threads 第 84 題](https://yocheng06.github.io/course-library/os.html?question=threads-084) | A、B、C、D | A. Two-level（題幹仍需確認） |
| [演算法 L2 第 22 題](https://yocheng06.github.io/course-library/algorithms.html?question=L2-022) | O(logn)^k | O((log n)^k) |
| [演算法 L2 第 25 題](https://yocheng06.github.io/course-library/algorithms.html?question=L2-025) | A、B、D | A、D |
| [演算法 L2 第 26 題](https://yocheng06.github.io/course-library/algorithms.html?question=L2-026) | A、C、D | A、C |
| [演算法 L4 第 3 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-003) | T(n)<=T(2n/3)+big_theta(1) | T(n)<=T(2n/3)+big-theta(1) |
| [演算法 L4 第 6 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-006) | greater | greater than or equal to（題幹仍需確認） |

Two-level 綁定題與 Max-Heap 的 greater 填空仍需確認題幹限定；雖提供較精確的教材答案，這三題暫不自動判分。

## 主要解析補強

- 漸進符號：區分函式上／下界與最好／最壞情況，補上正常數與函式範圍。
- 數學性質：用 x=0、x=1 的反例處理不等式，補上 floor／ceiling 的除數條件；階乘與 Fibonacci 說明成長率來源。
- 排序：推導插入排序的等差級數、Merge Sort 每層成本、Build-Max-Heap 按高度加總；說明穩定性與遞迴堆疊空間。
- 遞迴：補齊大師定理的多項式級差距與規則性條件、歸納基底、平移／對數變數代換。
- 程序與執行緒：說明 PCB 別名、模式位元與特權指令的差別、不同執行緒模型的阻塞與平行限制。
- 平台更新：區分 Android Dalvik／ART、Java 原生／虛擬執行緒、早期 Chrome 外掛程序、iPad 多前景場景、Windows named pipe 與 Linux FIFO。

## 仍需原題或條件的 50 題

可在網站選「全部單元」及「待確認」尋找。以下連結會直接定位到題目。

| 題目 | 疑點／需要補充 |
| --- | --- |
| [作業系統 architecture 第 6 題](https://yocheng06.github.io/course-library/os.html?question=architecture-6) | 題幹把「通常有使用者介面」寫成特定 CLI，缺少可核實的範圍。 |
| [作業系統 architecture 第 20 題](https://yocheng06.github.io/course-library/os.html?question=architecture-20) | 背景服務可屬系統程式；來源答案 D 與教材分類衝突。 |
| [作業系統 architecture 第 21 題](https://yocheng06.github.io/course-library/os.html?question=architecture-21) | C 未區分核心 CPU 排程與背景工作排程，需確認原文。 |
| [作業系統 architecture 第 29 題](https://yocheng06.github.io/course-library/os.html?question=architecture-29) | 選項 D 將 account management 與 accounting 混用。 |
| [作業系統 architecture 第 58 題](https://yocheng06.github.io/course-library/os.html?question=architecture-58) | 原答案 sleep() 分類有誤；目前選項未提供明確的資訊維護操作。 |
| [作業系統 architecture 第 71 題](https://yocheng06.github.io/course-library/os.html?question=architecture-71) | 「第一個」缺少歷史範圍與來源；Mach 可確認是重要早期專案。 |
| [作業系統 architecture 第 73 題](https://yocheng06.github.io/course-library/os.html?question=architecture-73) | 未明確區分整體 OS 設計與核心架構的 hybrid 分類。 |
| [作業系統 architecture 第 84 題](https://yocheng06.github.io/course-library/os.html?question=architecture-84) | A 的「覆蓋整個記憶體」不是正常執行的必然行為，需核對原題。 |
| [作業系統 architecture 第 113 題](https://yocheng06.github.io/course-library/os.html?question=architecture-113) | DTrace 與 top 都可即時觀察效能，現有單選題幹未限定摘要型監控工具。 |
| [作業系統 process 第 46 題](https://yocheng06.github.io/course-library/os.html?question=process-46) | 題幹問可能原因，D 也可能成立；來源答案依特定教材清單排除 D。 |
| [作業系統 process 第 52 題](https://yocheng06.github.io/course-library/os.html?question=process-52) | 未限定教材列舉，不能單憑清單排除 efficiency。 |
| [作業系統 process 第 53 題](https://yocheng06.github.io/course-library/os.html?question=process-53) | 未限定教材列舉，不能單憑清單排除 efficiency。 |
| [作業系統 process 第 55 題](https://yocheng06.github.io/course-library/os.html?question=process-55) | 未限定本機 OS 範例；Java RMI 也使用訊息交換。 |
| [作業系統 process 第 70 題](https://yocheng06.github.io/course-library/os.html?question=process-70) | 題幹把 non-blocking 寫成 synchronous，與教材分類矛盾。 |
| [作業系統 process 第 78 題](https://yocheng06.github.io/course-library/os.html?question=process-78) | 未指定平臺或開啟模式，具名管道不一定雙向。 |
| [作業系統 process 第 79 題](https://yocheng06.github.io/course-library/os.html?question=process-79) | 未指定平臺或開啟模式，具名管道不一定雙向。 |
| [作業系統 process 第 80 題](https://yocheng06.github.io/course-library/os.html?question=process-80) | 未指定平臺或開啟模式，具名管道不一定雙向。 |
| [作業系統 process 第 81 題](https://yocheng06.github.io/course-library/os.html?question=process-81) | 未指定平臺或開啟模式，具名管道不一定雙向。 |
| [作業系統 process 第 91 題](https://yocheng06.github.io/course-library/os.html?question=process-91) | 未指定版本與裝置，單一前景程序不是所有現代 Apple 行動系統的通則。 |
| [作業系統 process 第 92 題](https://yocheng06.github.io/course-library/os.html?question=process-92) | 未指定版本與裝置，單一前景程序不是所有現代 Apple 行動系統的通則。 |
| [作業系統 process 第 93 題](https://yocheng06.github.io/course-library/os.html?question=process-93) | 原答案採早期外掛架構，題幹未指定 Chrome 版本。 |
| [作業系統 process 第 97 題](https://yocheng06.github.io/course-library/os.html?question=process-97) | B「行程」與 C「程序」都是 process 的譯名，單選無法唯一判斷。 |
| [作業系統 process 第 98 題](https://yocheng06.github.io/course-library/os.html?question=process-98) | A 把 Thread 譯成行程，造成與 process 的術語混淆。 |
| [作業系統 process 第 104 題](https://yocheng06.github.io/course-library/os.html?question=process-104) | 題幹把 non-blocking 寫成 synchronous，與教材分類矛盾。 |
| [作業系統 process 第 110 題](https://yocheng06.github.io/course-library/os.html?question=process-110) | 原答案採早期外掛架構，題幹未指定 Chrome 版本。 |
| [作業系統 threads 第 18 題](https://yocheng06.github.io/course-library/os.html?question=threads-018) | 題幹未限定是否指多對多模型額外提供的專屬綁定功能，需核對原題。 |
| [作業系統 threads 第 31 題](https://yocheng06.github.io/course-library/os.html?question=threads-031) | C 對自動區域變數也可能成立，D 則需排除 static 區域變數；原題範圍不足。 |
| [作業系統 threads 第 84 題](https://yocheng06.github.io/course-library/os.html?question=threads-084) | 題幹未限定是否指多對多模型額外提供的專屬綁定功能，需核對原題。 |
| [演算法 L2 第 8 題](https://yocheng06.github.io/course-library/algorithms.html?question=L2-008) | 題幹混同上／下界與最壞／最佳情況；需確認原題實際要填的符號。 |
| [演算法 L3 第 10 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3-034) | 選項「無法進行代數變換」含義不明，需核對原文是否指代數推導困難。 |
| [演算法 L3 第 19 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3-016) | 題幹缺少每層成本的量級，無法選出唯一總成本。 |
| [演算法 L3 第 20 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3-017) | 未給遞迴式或葉節點數，葉層總成本不一定為線性。 |
| [演算法 L3 第 30 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3q-11c3767f47ff) | 「慢於 O(n^(log_b a))」不夠精確；缺少多項式級差距條件。 |
| [演算法 L3 第 32 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3q-a0628258a256) | A 是 B 的特例；目前單選題幹未明確限定通用標準形式。 |
| [演算法 L3 第 33 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3-023) | D 未限定 Case 1／3；需確認課程採用的大師定理版本。 |
| [演算法 L3 第 39 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3q-e529090709c4) | 題幹漏了多項式級差距與規則性條件，不能只看「大於」。 |
| [演算法 L3 第 59 題](https://yocheng06.github.io/course-library/algorithms.html?question=L3q-aa439b2239eb) | 題幹只有顯式解，疑似漏了原始遞迴式。 需提供原題的完整遞迴式與基底條件。 |
| [演算法 L4 第 6 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-006) | 原題單字填空不足以表達允許相等的堆積性質。 |
| [演算法 L4 第 16 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-016) | 缺少目前完整陣列、i、heap-size 與程式停留位置。 |
| [演算法 L4 第 17 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-017) | 缺少目前完整陣列、i、heap-size 與程式停留位置。 |
| [演算法 L4 第 18 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-018) | 缺少完整陣列、目前 i、heap-size，以及是在交換前或修復後的圖示。 |
| [演算法 L4 第 19 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-019) | 缺少完整陣列、目前 i、heap-size，以及是在交換前或修復後的圖示。 |
| [演算法 L4 第 41 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-041) | 原答案把非普遍成立的理由全列為正確；又缺少原選項與比較情境。 |
| [演算法 L4 第 43 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-043) | 原答案只列最初三個節點，原題未交代問的是首次比較還是完整影響範圍。 |
| [演算法 L4 第 46 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-046) | 缺少 Min-Max Heap 原樹圖、問號位置與候選值。 |
| [演算法 L4 第 47 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-047) | 缺少附行號的 Max-Heapify 虛擬碼與原選項。 |
| [演算法 L4 第 53 題](https://yocheng06.github.io/course-library/algorithms.html?question=L4-053) | 題幹未限定遞迴版，來源答案中的「使用遞迴」不是必要性質。 |

## 維護時的優先順序

1. 補上 L2 第 48、49 題的行號虛擬碼與成本表；L3 第 59 題的原始遞迴式；L4 第 16–19、46、47 題的完整圖與程式碼。
2. 取得所有 L4 選擇題原選項。未附選項的題目仍可練習觀念，但無法可靠核對原選項或題意。
3. 確認平台答案與教材有差異的題目，特別是 Two-level 綁定、interrupt 分類、PCB 別名；學校答案若不同，應分開記錄考試鍵與概念答案。
4. 日後新增題目至少附：完整題幹、選項／題圖、答案、解題理由、適用條件與可核對來源。

## 參考資料

- [MIT：漸進分析與遞迴關係式](https://ocw.mit.edu/courses/6-046j-introduction-to-algorithms-sma-5503-fall-2005/81d240e8db219502712349254cdd5272_whjt_N9uYFI.pdf)
- [MIT：Binary Heaps](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-8-binary-heaps/)
- [Operating System Concepts：系統結構](https://www.cs.umd.edu/class/spring2020/cmsc412/Slides/Set3%20-Chapter%202.pdf)
- [Operating System Concepts：程序管理與 PCB](https://os.ecci.ucr.ac.cr/slides/9th-Edition/2012-pdf/ch03.pdf)
- [UIC：Threads](https://www.cs.uic.edu/~jbell/CourseNotes/OperatingSystems/4_Threads.html)
- [Linux：fork](https://man7.org/linux/man-pages/man2/fork.2.html)、[Pipes／FIFOs](https://man7.org/linux/man-pages/man7/pipe.7.html)、[Signals](https://man7.org/linux/man-pages/man7/signal.7.html)
- [Microsoft：Named Pipes](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipes)
- [Android：平台架構](https://developer.android.com/guide/platform)
- [OpenJDK JEP 444：Virtual Threads](https://openjdk.org/jeps/444)
- [Chromium：多程序架構](https://www.chromium.org/developers/design-documents/multi-process-architecture/)
- [Apple：多工與多場景](https://developer.apple.com/documentation/uikit/multitasking-on-ipad-mac-and-apple-vision-pro)

## 檢查記錄

- 550 題的數量與穩定 ID 和修正前一致，沒有改動題幹、原選項與題序。
- 12 題修改前答案均另存供對照。
- 修改的 JavaScript 通過語法檢查，Git diff 無空白格式錯誤。
- 抽看 390px 手機與 1280px 桌面上的修正題目、來源答案與參考連結，未見水平溢出或 JavaScript 頁面錯誤。
- 未新增或執行自動化測試套件。

## 2026-10-09：初次匯入作業系統 L6 CPU 排程（後續已合併完整題庫）

- 自提供的 `作業系統 L6.html` 匯入 104 題，作業系統增加為 5 個單元、474 題，全站共 654 題。
- 保留 `os6-001` 至 `os6-104` 的來源題號、題序、題幹、答案、備註，以及 18 題的中英文版本；既有 370 題的資料完全保留。
- 原檔未附完整選項，不把來源的正確答案當作完整選項。31 題多選題保留多選分類與全部答案；42 題填空和 31 題問答沿用網站的「填空／簡答」格式。104 題皆以文字練習及自行核對方式呈現。
- 5 題來源標示為考點重建題，保留重建說明並加入完整原題的核對提醒。來源標示的老師／官方答案屬來源自述，本站未登入學校系統核驗。
- 第 34 題解析將 `shortest-job-first` 的「四段」更正為「三個單字」，不改動來源答案。

下列疑點保留來源答案並標示待確認：

| 題號 | 核對提醒 |
| --- | --- |
| `os6-020` | Running → Waiting 會喚起排程器；來源 `wakeup` 與一般術語有出入。 |
| `os6-039` | RR 要近似 FCFS，時間片須足以涵蓋 CPU burst；僅相對切換時間很大並不充分。 |
| `os6-056` | 缺少原選項，無法確認 `None of answer` 的選項設計與題意。 |
| `os6-091` | 題幹問六個 Solaris 排程類別，但來源只列出四個答案。 |

此次為題庫格式匯入及疑點標記，沒有逐題重新核驗 L6 的全部答案與教材版本。

匯入驗證：104 題的題序、ID、題幹、答案及中英文版本逐筆比對通過，既有 370 題的資料完全一致；JavaScript 語法與 Git diff 檢查通過。以本機 HTTP 預覽操作 1280px 桌面與 390px 手機尺寸，確認單元導覽、目前／全部單元搜尋、文字練習、待確認篩選、待複習保存、首末題直接連結與快速換頁，未見頁面 JavaScript 錯誤或整頁水平溢出。


## 2026-10-09：合併 L6 完整題庫與去重

完整題庫 `作業系統L6_完整題庫本.html` 有 7 批、210 筆。只讀取題目資料，不執行上傳 HTML 的互動程式。逐批比較題幹、完整選項集合與正確選項文字：71 筆為同題換序或重複批次，剩 139 組題幹；其中 34 組中英文對照合併至同一張題卡，共 105 道來源題目。另保留既有的 SJF → SRTF 反向問答，其要求的答案與新增的 SRTF → SJF 不同；此題仍標示為先前整理的非原文問答，最終 L6 共 106 題。

- 新增 5 題：`os6-105` 非對稱多處理填空、`os6-106` 排程評估方法、`os6-107` SCHED_RR 政策特性、`os6-108` SRTF 的原演算法、`os6-109` 多層級回饋佇列的老化方式。
- 合併 3 組既有重複題，舊 ID 作為別名保留：`os6-028` → `os6-027`、`os6-093` → `os6-092`、`os6-104` → `os6-072`。舊直接連結仍可定位；本機待複習紀錄會轉存至合併後 ID，同一題只計一次。
- 58 道既有題補齊選項，加上 4 道新增選擇題，合計 31 道單選、32 道多選、43 道文字題；40 張題卡提供對照題幹。選項採固定的一組來源順序，答案字母依該組索引重新產生，避免混用不同批次的字母答案。
- 作業系統共 5 個單元、476 題，全站共 656 題；其他 4 個作業系統單元的 370 題及演算法 180 題不變。
- 移除已補齊題目的「未附選項」提醒；SMP 自行排程題 `os6-056` 已取得完整選項，可確認以上皆非的對應關係。保留 `wakeup`、RR 比較條件、Solaris 六類只列四個選項等未解疑點。
- 完整題庫有 7 筆標示未提供本題公布答案：RR 計算、Windows 時間片到期、RM 特性、EDF 英文填空、硬即時特性、deadline 填空及評估方法。合併後保留核對提醒；有選項但缺乏公布答案的題目暫不自動判分。
- 硬即時特性題 `os6-065` 的完整題庫列 A、D，原整理版只列符合截止期限。保留原答案供對照、標示來源衝突，暫不自動判分。RR 計算題明列到達時間與初始順序的假設，不把推算答案宣稱為已公布答案。

此次以提供的檔案合併資料並補充適用條件，未登入學校系統核驗公布答案。題目畫面維持既有網站格式；課間電台仍暫停，未恢復題目參考連結功能。

合併驗證：210 筆來源均對應至合併後題目；63 道選擇題逐題比對來源正確選項與自動核對結果，無選項換序造成的答案偏移。既有 370 道作業系統題目與演算法題庫資料不變，所有正式 ID 唯一，3 個舊 ID 別名可定位且能保存既有待複習標記。L6 共 11 題列為待確認。JavaScript 語法與 Git diff 檢查通過；本機 HTTP 預覽檢查桌面及 390px 手機、標準／大字、單多選核對、文字作答、解析命中提示與遮答、目前／全部單元搜尋、待確認篩選、手機單元切換與換頁，未見頁面 JavaScript 錯誤或整頁水平溢出。


## 2026-10-09：移除冗餘題目備註

- 移除 28 題重複答案、答案格式、平台已確認或重複解析的備註，包括使用者指出的 `os6-006` 與 `os6-009`；不再顯示「高頻錯題」標籤。答案、解析與題幹中的原有作答要求保留。
- 簡化 `os6-035`、`os6-042`、`os6-072` 的備註，只保留重建題或未提供公布答案的資料限制；其餘來源疑點、歷史版本與影響解題的適用條件保留。
- 沒有備註的題目沿用既有條件渲染，不產生空白「題目備註」區塊。待確認標記與不自動判分的條件不變。

驗證：逐題比對確認只修改 31 題的備註欄位，其餘 476 題的 ID、題幹、選項、答案、解析與判分保護欄位保留；待確認名單仍為 46 題。Git diff 檢查通過。本機瀏覽器確認 `os6-006` 與 `os6-009` 沒有備註區塊、答案與解析正常顯示，未見頁面 JavaScript 錯誤。


## 2026-10-09：依提供答案判定題目狀態

依使用者要求「只要我有給你題庫的答案，題目都算沒問題」，將作業系統 476 題、演算法 180 題標記為已提供答案，正常顯示。即使先前標為缺圖、缺選項、資料不完整或題意有疑點，只要已附答案，皆不再列為待確認，不因舊疑點暫停選項核對。

- 移除舊 `reviewIssue`、`missingContext` 與警告標記，清掉要求另行核對答案的備註與解析中的暫停判分／未核驗提示；保留有助理解的概念、推導與適用條件。
- 已提供答案的題目不顯示待確認徽章、缺圖警告或答案標題中的待確認字樣。搜尋也不再命中已失效的疑點資料。
- 題目、選項、目前答案、修正前答案、ID、別名與題序保留。選項能對應答案時自動核對；文字題或無法對應選項的答案維持自行對照。
- 將本次規則寫入 README，後續匯入已附答案的題目時沿用；未提供答案的題目仍保留待確認功能。

驗證：656 題皆為正常狀態，369 道可對應選項的題目依目前答案核對通過；另驗證已提供答案可覆蓋舊疑點／缺圖標記、未提供答案仍保留待確認，以及備註不再命中已失效的疑點。題目、選項、答案、原答案、ID、別名與題序逐題比對不變。JavaScript 語法與 Git diff 檢查通過；本機瀏覽器確認兩科待確認數為 0，舊暫停題目可正常核對單多選，文字題可作答並自行對照，390px 手機未見水平溢出或頁面 JavaScript 錯誤。


## 2026-10-10：合併更新版 L6 完整題庫

新版 `作業系統L6_完整題庫本.html` 共 9 批、270 筆，比上一版增加 60 筆。只解析題目資料，不執行上傳 HTML 的程式。依題幹、作答要求、正確選項文字合併重複批次、選項換序與中英文同題；新增的時間片長度填空與既有 `os6-037` 具相同作答要求，合併至原題。270 筆資料對應 112 張來源題卡，加上既有 SJF → SRTF 反向問答，L6 共 113 題。

- 新增 `os6-110`（來源 214）：SRTF 原演算法填空，答案 SJF；保留來源要求的大寫縮寫，與既有選擇題的作答形式不同。
- 新增 `os6-111`（來源 234）：執行轉就緒的排程類型填空，答案 preemptive。
- 新增 `os6-112`（來源 248）：根據資料到期時間的即時排程名稱填空，答案 earliest deadline first。題幹已包含 scheduling algorithm，保留新版的名稱填答，與 `os6-072` 的完整名稱填答區分。
- 新增 `os6-113`（來源 255）：Little 公式特性，多選 A、C、D；解析說明穩態與長期平均條件。
- 新增 `os6-114`（來源 262）：CPU 排程決策事件，多選 A、B、C、D。
- 新增 `os6-115`（來源 267）：CPU 爆發長度估計，多選 A、B、C；解析保留指數平均公式、α = 1 的意義及使用者提供估計資訊。
- 新增 `os6-116`（來源 268）：分派延遲名稱填空，答案 dispatch latency；與既有概念定義選擇題的作答方向不同。
- 補上 9 題的中英文對照，更新 `os6-103` 的中文題幹對照；中英文題卡共 49 張。
- `os6-065` 依新版來源 13、269，由 A、D 改為只選 D「任務必須在截止時間內完成」，題型改為單選，保留原有答案歷史。`os6-060` 補充硬體多執行緒利用記憶體停頓的條件。
- L6 有 32 題單選、34 題多選、47 題填空／簡答；作業系統共 483 題，演算法 180 題，全站共 663 題。
- 所有新題設定 `answerProvided: true`，不依來源 `confirmed` 欄位或先前疑點重新列為待確認；不加入重複答案的備註。原有 ID、3 個舊 ID 別名、題序與待複習儲存方式保留。課間電台持續暫停，題目參考連結功能維持取消。

資料驗證：270 筆來源皆對應至網站題目，逐筆比對正確選項文字與填答內容，排除換序造成的答案偏移；所有 ID 唯一、同形式題幹無重複，既有其他 4 個作業系統單元的 370 題不變。

瀏覽器驗證：作業系統 300 道、演算法 72 道可對應選項的題目均能依目前答案核對，全站 663 題待確認數為 0。新版單選、全選與一般多選核對、4 題新增文字作答、解析命中與遮答、目前／全部單元搜尋、舊 ID 定位與待複習遷移／保存均通過。390px 手機標準／大字、單元切換與換頁未見整頁水平溢出或頁面 JavaScript 錯誤；內嵌 JavaScript 語法及 Git diff 檢查通過。演算法題庫資料不變。


## 2026-10-10：更新 L2 作業系統基礎題庫

依使用者提供的 `作業系統_L2_題庫.html` 更新，重點處理第 40 題後的選項版本及缺題。只解析 `CHAPTER1_QUESTIONS` 資料，不執行上傳 HTML 的程式。來源共 128 筆；依考點、正確選項文字及填答要求合併重複批次、換序與中英文對照，整理為 67 題，比原有 46 題新增 21 題。同一題幹若正確選項內容不同，保留各版本，例如含 FaaS／PaaS 的雲端服務模型、排除 Array／包含單向串列的核心資料結構、不同活動集合的程序管理；不同的填答方向或指定格式亦保留。

- 同題採提供資料中的較新選項順序，依正確選項文字重算答案字母，不將不同版本的原答案字母直接套用。
- `basics-41` 改為新版 GPL 選項版本，答案 D；`basics-42` 改為記憶體管理、CPU 排程的原題選項版本，答案 A、C；`basics-46` 改為循環資源管理的鏈結串列版本，答案 D。`basics-43`、`basics-44`、`basics-45` 的提供答案維持；保留先前精確說明中斷／例外來源的解析。
- `basics-9` 依提供答案選軟體中斷、錯誤引發；最新順序為 A、C。`basics-29` 依提供答案選 Mode bit、Privileged instructions；最新順序為 B、C。兩題保留更新前答案的完整選項文字，避免換序後歷史答案字母造成誤解。
- 既有 `basics-1` 至 `basics-46` ID 保留相同考點，舊連結與待複習紀錄繼續有效。原先未附選項的系統呼叫模式轉換、即時系統特徵，利用新版完整選項補齊並合併至對應題目。
- 依來源補上解析，移除已核對、大小寫／空格重複說明與要求另外確認的備註；作答格式留在題幹，含義與適用條件保留於解析。來源的 Disk formating、Networkr-request 拼字統一為 Disk formatting、Network-request；清除不再對應新版選項的名詞提示。
- L2 共 50 題有選項、17 題填空／簡答，13 張中英文對照題卡。作業系統總數 504 題，演算法維持 180 題，全站 684 題。所有提供答案的題目皆為正常狀態，無新增待確認或暫停判分標記。
- 其他 4 個作業系統單元的 437 題資料不變。課間電台維持暫停，題目參考連結功能維持取消。

新增題目對應如下（來源編號為上傳檔中的順序）：

- `basics-47`（來源 47）：Protection；答案 group id。
- `basics-48`（來源 48）：Interrupt；答案 Interrupt。
- `basics-49`（來源 50、104）：Protection；答案 C。
- `basics-50`（來源 51、89、107、122）：Process；答案 B、C。
- `basics-51`（來源 55）：Cloud；答案 iaas。
- `basics-52`（來源 58、120）：Interrupt；答案 timer。
- `basics-53`（來源 59、78）：Storage；答案 A、B、C、D。
- `basics-54`（來源 63、81、100）：Multiprocessing；答案 A、B、D。
- `basics-55`（來源 64、101）：Computer System；答案 B、D。
- `basics-56`（來源 66）：Cluster；答案 high availability。
- `basics-57`（來源 69）：Cluster；答案 san。
- `basics-58`（來源 70、87）：Kernel Data Structures；答案 O(lgn)。
- `basics-59`（來源 71）：Storage；答案 cache coherency。
- `basics-60`（來源 75、109）：Storage；答案 B。
- `basics-61`（來源 85）：Cloud；答案 A、C、D。
- `basics-62`（來源 93）：Kernel Data Structures；答案 B、C、D。
- `basics-63`（來源 95）：Multiprocessing；答案 asymmetric and symmetric。
- `basics-64`（來源 99）：Process；答案 A、B、C、D。
- `basics-65`（來源 102）：I/O；答案 spooling。
- `basics-66`（來源 108）：I/O；答案 dma。
- `basics-67`（來源 117）：Virtualization；答案 vmm。

資料驗證：逐筆確認 128 筆來源的正確選項文字／填答內容皆對應至 67 張題卡，已排除換序造成的答案偏移；全站 ID 無衝突，既有 46 個 L2 ID 與其他 437 道作業系統資料保留。

瀏覽器驗證：L2 的 50 道選項題及作業系統其他 259 道可對應選項的題目，正確／錯誤選項核對均符合目前答案。實際操作第 9、29、41、42、46 題、FaaS／PaaS 與核心資料結構版本、文字作答、題幹／解析命中與遮答、目前／全部單元搜尋、待確認 0 題、既有及新題待複習保存、390px 手機標準／大字、單元切換與換頁均通過，未見整頁水平溢出或頁面 JavaScript 錯誤。演算法題庫逐筆確認不變；內嵌 JavaScript 語法與 Git diff 檢查通過。


## 2026-10-10：移除兩道未提供新版原題選項的 L2 題目

依使用者要求「看有沒有更新的，沒有就刪了」，再次檢查最新 `作業系統_L2_題庫.html` 的 128 筆及現有附件：Resource allocator 與 Protection mechanism 僅各出現一次，來源 43、45 仍註明選項依概念整理、原題選項順序未提供，未找到更新選項版本。

- 刪除 `basics-43`「作業系統作為 Resource allocator 代表什麼？」及 `basics-45`「Protection mechanism 的主要用途？」。
- 其餘題目的 ID、選項、答案、解析與相對題序不變，不將已刪除 ID 分配給其他題目。待複習紀錄沿用既有有效 ID 過濾，已刪題目的標記不再保留。
- L2 改為 65 題，其中 48 題附選項、17 題填空／簡答；作業系統 502 題，演算法 180 題，全站 682 題。

資料比對確認只移除指定兩題，其餘 502 道作業系統題目資料不變；靜態題數、來源說明與 README 同步更新。

本機瀏覽器確認兩題搜尋及題卡已移除，已刪題目的舊連結正常返回 L2，保留題目仍可定位；待複習自動移除兩個失效 ID，其他標記保留。L2 65 題、作業系統 502 題及手機最後一頁 61–65 題顯示正確，未見整頁水平溢出或頁面 JavaScript 錯誤。Git diff 檢查通過。

## 2026-10-10 全站題目編排整理

- 合併 L5 的 `threads-087` 與 `threads-028` TLS 填空題，保留 `threads-087` 作為舊 ID 對應，既有連結與待複習標記會轉到保留題。L5 現為 90 題，作業系統 501 題、演算法 180 題，全站 681 題。
- 將 `process-105`、`process-106` 歸入 `PCB / Context Switch`，`process-99` 統一歸入 `Process State`，`os6-014` 歸入「排程基本觀念」。
- 作業系統 L2／L4／L5／L6 與演算法 L4 按主題集中排列；L6 先列基本觀念，演算法 L4 先列 Heap 基礎、索引與性質，再列 Heapify、Build Heap、Heapsort、Priority Queue 與進階／追蹤題。
- 演算法 L4 在重排前固定 57 題原有 ID。來源為選擇題卻未附選項的 39 題，題卡與題型篩選改顯示「文字作答」，來源題型仍保留在資料中。
- 各題題幹、選項、答案與解析保留原內容；不同選項版本保留，已提供答案的題目繼續視為正常。

資料比對確認僅合併指定一題、修改四個分類與增加固定 ID／舊 ID 對應；八個單元的同分類題目均連續排列，固定 ID 與別名沒有衝突。

本機 Chromium 驗證全部 682 個原題目 ID 的對應、合併題書籤移轉、39 題文字作答篩選、379 題可自動核對選項的題庫答案，以及手機單元切換、大字與快速換頁。未見頁面 JavaScript 錯誤或整頁水平溢出；JavaScript 語法與 Git diff 檢查通過。

## 2026-10-10 演算法 L4 更新題庫與題圖

以使用者提供的「演算法L4_更新_59題.html」更新 L4，取題卡實際顯示的題幹、選項、答案與解析，避免使用檔案中殘留舊選項順序的搜尋欄位。59 題全部整合，另依使用者確認保留原有 `L4-009` 陣列儲存填空題，L4 共 60 題；演算法共 183 題，全站共 684 題。

- 56 題更新既有內容，3 題新增為 `L4-058`（Heap-Underflow）、`L4-059`（Max-Heapify 參數）、`L4-060`（Build-Max-Heap 複雜度填空）。既有 57 個 L4 固定 ID 與待複習標記均保留，題序仍按主題集中排列。
- 加入 6 張來源原圖：兩題 Build-Max-Heap、兩題 Heapsort、Min-Max Heap 與 Max-Heapify 虛擬碼。圖片儲存在 `assets/questions/algorithms-l4/`，內容與來源逐位元組一致。
- 題卡在揭答前就能閱讀題圖，可開啟原尺寸查看；圖片依容器縮放，附文字替代說明與原尺寸查看連結。
- 圖片中的 Min-Max Heap 與虛擬碼四個選項轉成可作答選項。L4 共 38 題附可作答選項、16 題填空、4 題追蹤及 2 題文字作答；各題依提供的答案練習，不列為待確認。
- Min-Max Heap 題保留來源答案 `B、C（9、5）`，作答核對使用等價的 `B、C`；Max-Heapify 遞迴式採更新檔的 `T(n)<=T(2n/3)+big-theta(1)`。未引入重複答案備註或題目參考連結。

資料檢查確認 L2／L3 題庫完全不變、59 題來源內容均匯入、沒有完全重複題。Chromium 驗證原有演算法 180 個 ID、書籤、6 張題圖的桌機與手機載入、原尺寸連結、38 題選項核對、搜尋／題型篩選、大字與快速換頁。未見圖片請求失敗、頁面 JavaScript 錯誤或整頁水平溢出；JavaScript 語法及 Git diff 檢查通過。

## 2026-10-12 圖題題幹恢復原文

依使用者要求，逐一對照六張原圖，將 `L4-016`、`L4-017`、`L4-018`、`L4-019`、`L4-046`、`L4-047` 的文字題幹改回原題用字。移除先前自行加入的執行位置與改寫說明，不將虛擬碼抄進題幹；程式碼仍可在原始題圖閱讀。題目 ID、順序、選項、答案、解析與圖片檔案均保留。

## 2026-10-13 解析內容補強

依使用者要求改善解析，以原因、操作步驟、可計算例子及適用條件取代僅重述答案的內容；保留所有原題題幹、翻譯、選項、答案、圖片、ID 與題序。全站仍為 684 題，398 題解析重寫、補強或統一用詞。

| 科目／單元 | 題數 | 本次更新解析 |
| --- | ---: | ---: |
| 作業系統 L2 基礎 | 65 | 60 |
| 作業系統 L3 架構 | 121 | 55 |
| 作業系統 L4 程序 | 112 | 39 |
| 作業系統 L5 執行緒 | 90 | 11 |
| 作業系統 L6 排程 | 113 | 112 |
| 演算法 L2 基礎 | 63 | 14 |
| 演算法 L3 遞迴 | 60 | 47 |
| 演算法 L4 Heap | 60 | 60 |

- Heap 解析補入父子關係、索引前提、單一路徑修復、Build-Max-Heap 的高度加總、原地與遞迴空間差異、Priority Queue 各操作，以及四題原圖逐步交換位置。
- 最小－最大堆積圖題從祖先限制推得 `4≤?≤40`，說明為何 9、5 符合、2、3 不符合。
- 排程解析區分就緒／等待、搶佔／非搶佔、排程器／分派器，以及周轉／等待／回應時間；加入 SJF 兩工作等待時間比較、指數平均、RR 開銷比例與各政策條件。
- 遞迴解析補入猜測與歸納的分工、`cn−1` 加強假設範例、每層與葉層成本、標準大師定理的條件，並說明 floor／ceiling 與基底不可任意略去。
- 其他解析補入系統服務、API、程序、執行緒與平台版本的作用機制，統一「資料、伺服器、網路、記憶體、佇列」等用詞。移除只有拼字提醒、舊測驗格式或無依據「官方最新接受」的解析文字。

資料比對逐題確認除解析欄位外，684 題全部欄位均與更新前一致，已提供答案的題目狀態不變。獨立計算檢查 SJF 等待例子、指數平均、Little 定律數值、兩題 Heapsort 與一題 Build-Max-Heap 交換結果，以及最小－最大堆積的可填範圍。

本機 Chromium 確認分段標題與公式正常呈現、圖題選項核對與新解析揭答正常、特殊數學符號可搜尋到解析且遮答前不洩漏答案，手機標準／大字閱讀未見整頁水平溢出。頁面 JavaScript 錯誤與資源請求失敗均為零；內嵌程式語法與 Git diff 檢查通過。

## 2026-10-14：更新 L6 十批完整題庫

更新來源 `作業系統L6_完整題庫本.html`，共 10 批、300 筆。只解析題目 JSON，不執行來源 HTML 的程式。沿用既有去重方式，把中英文對照、重複批次、選項換序和同一填空的改寫合併為 113 道來源題目；另保留原有 `os6-035` 的 SJF／SRTF 反向問答，L6 共 114 題。

- 新增 `os6-117`，來源第 10 批第 23 題（來源 293）：優先權排程解決飢餓問題的英文填空，答案 `aging`。沿用網站的優先權／飢餓分類，解析說明提高久候工作優先權的機制。
- `os6-110` 依來源 285，更新 SRTF 原演算法填空的作答格式與答案為 `shortest-job-first`，取代舊版大寫縮寫；固定 ID 保留。
- 更新中英文對照，涵蓋來源 272 的回應時間、278 的分派器、280 的時間片長度、290 的多層級回饋佇列及 298 的 SCHED_FIFO。更新題幹使用來源原文；同題不另加重複卡片。
- 重複選項換序依正確選項文字重映射答案，已有選項順序能沿用時保留；修訂的選項採最新來源。300 筆來源都可在整合對應表中定位到正式題卡。
- 原有 113 個固定 ID 及所有別名均保留，已有完整解析不被來源的簡短答案／拼字提示取代。新增題也不加重述答案的備註。
- 所有已提供答案的題目維持 `answerProvided: true`，不依來源 `confirmed: false` 增加待確認標記。L6 有 66 題選擇題、48 題填空／簡答；作業系統共 502 題，演算法維持 183 題，全站共 685 題。
- 同步投稿服務的正式題庫索引，讓新版題庫參與重複投稿檢查。

驗證：300 筆來源皆映射到正式題卡，114 題固定 ID 唯一；保留原有 113 個 ID 與所有別名，其餘四個作業系統單元逐筆不變。66 題選擇題依目前答案核對通過，新題文字作答、更新答案格式、跨單元搜尋、舊別名連結與待複習標記正常；390px 手機沒有整頁水平溢出或 JavaScript 錯誤。投稿服務 6 項權限測試通過，新 aging 題再次投稿會被新版索引攔下。


## 2026-10-16：已核准 L6 投稿解析補充

為已核准投稿 `65307e6c-1612-4c30-b48f-0489756453b5` 的 76 題補上解析，涵蓋 CPU 排程基礎、評估指標、FCFS／SJF、RR、優先權與多層級佇列、多處理器、即時排程、Linux／Windows／Solaris、效能評估及虛擬化。原題、題目 ID、答案與核准狀態保留。

較長的 RR 執行順序題列出 A～H 時間區間及剩餘量，依答案使用同時到達、初始佇列 P1/P2/P3、忽略切換成本的前提。SJF 最佳性區分同時可執行、已知 burst 的模型；RR 退化為 FCFS 的條件須比較時間片與 burst，不能只比較切換成本。題庫答案對選項範圍的限制直接在解析中說明，不以缺圖、選項疑點或教材版本差異重新標為待確認。

傳統 CFS 與 EEVDF、Windows UMS 的支援版本、動態優先權提升與衰減，以及 Solaris 四個選項與六種排程類別的差別，均在對應題目交代。完整解析與各題來源對應見 `contribution-service/content/approved-explanations.json`，題目畫面不顯示參考連結。

查核資料：

- [CPU Scheduling 課程筆記（UIC）](https://www.cs.uic.edu/~jbell/CourseNotes/OperatingSystems/6_CPU_Scheduling.html)
- [Linux CFS 設計](https://www.kernel.org/doc/html/v6.6/scheduler/sched-design-CFS.html)與 [EEVDF](https://docs.kernel.org/scheduler/sched-eevdf.html)
- [Windows 優先權](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities)、[優先權提升](https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts)與 [UMS](https://learn.microsoft.com/en-us/windows/win32/procthread/user-mode-scheduling)
- [Solaris 排程器](https://docs.oracle.com/cd/E53394_01/html/E54815/psched-82475.html)

## 2026-10-22：作業系統 L7 解析逐題檢視

逐一檢視 L7 的 137 題，重寫其中 90 題的目前顯示解析，將不相干或只列同步工具名稱的模板改為題目所問的原因、操作順序、選項區別與成立條件。其餘 47 題已有對應題意的說明，沿用原文。

| 主題 | 更新解析數 |
| --- | ---: |
| 臨界區、核心與同步風險 | 17 |
| 硬體原子指令與 Peterson 解法 | 8 |
| 同步工具、Semaphore 與 Monitor | 30 |
| 經典同步案例、有界緩衝區與讀者寫者 | 15 |
| 哲學家進餐 | 5 |
| 系統實作與替代同步方法 | 15 |

- `os7-059` 改為說明 CPU burst 與 I/O burst 的交替；`os7-176` 說明 OpenMP 的編譯器指示詞與 critical 區域，不再套用泛用臨界區模板。
- Semaphore 解析區分忙碌等待與阻塞式實作、許可計數與負值等待者模型；Monitor 解析區分互斥進入與條件變數，說明被通知後仍可能需要重新取得鎖並重查條件。
- 生產者／消費者題依序解釋 empty、full、mutex 的工作；讀者寫者題說明 read_count、mutex 與 rw_mutex 的分工；哲學家題區分死鎖避免與飢餓保證。
- Linux futex、Solaris adaptive mutex、Windows 同步物件、POSIX API 與 Java 記憶體模型均補入對應用途或實作條件，避免把教材的簡化模型擴大為所有版本與實作。
- `os7-091` 移除和目前答案代號不一致的「官方只接受 D」說法；`os7-082` 說明既有答案以生產者流程為前提；`os7-321` 明示題目在一般 Windows 同步物件分類下存在單選歧義。這些調整僅澄清來源與一般觀念的差異，沒有重新指定答案。
- `os7-278` 缺漏的選項 A 及其提示完整保留，未自行補造選項。來源版本的原始解析、來源答案與合併紀錄也都保留，未以新解析覆寫原稿。

驗證：對照修改前後的全部 579 道作業系統題目，排除目前解析欄位後，逐筆資料完全相同；題幹、選項、翻譯、備註、答案、`choiceKey`、ID、別名、題序、來源版本及來源答案均未更動。L7 維持 137 題，`process-11` 的答案仍為 `process control block`。單元 JSON 外的 HTML 完全相同，資料可經 `scripts/course-data.mjs` 解析；90 題舊／新解析及雜湊比對結果另存於本次工作階段的驗證紀錄。

查核資料（只供維護查核，不加入題卡顯示）：

- [Operating Systems: Three Easy Pieces（作者提供之教材；Locks、Condition Variables、Semaphores）](https://pages.cs.wisc.edu/~remzi/OSTEP/)
- [UIC：Process Synchronization 課程筆記](https://www.cs.uic.edu/~jbell/CourseNotes/OperatingSystems/5_Synchronization.html)
- [OpenMP 5.2：critical construct](https://www.openmp.org/spec-html/5.2/openmpse90.html)
- [Linux man-pages：futex(7)](https://man7.org/linux/man-pages/man7/futex.7.html)
- [Oracle Solaris 11.4：Adaptive Lock Probes](https://docs.oracle.com/en/operating-systems/solaris/oracle-solaris/11.4/dtrace-guide/lockstat-adaptive-lock-probes.html)
- [Microsoft：Synchronization Objects](https://learn.microsoft.com/en-us/windows/win32/sync/synchronization-objects)及 [Semaphore Objects](https://learn.microsoft.com/en-us/windows/win32/sync/semaphore-objects)
- [Java SE 17 Language Specification：Threads and Locks](https://docs.oracle.com/javase/specs/jls/se17/html/jls-17.html)
- [POSIX：Synchronization 與記憶體同步要求](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap04.html)

## 2026-10-26：刪除演算法 L6 原第 27 題

依使用者確認，移除原顯示第 27 題 `L6-037`（辨識問題），保留原第 28 題 `L6-038` 的題幹、選項、答案、解析與來源版本。刪除題不再作為獨立卡片或批次查題條目；舊 ID 對應保留題，以延續連結及待複習標記。第六章由 58 題改為 57 題，演算法內建題庫由 298 題改為 297 題。

原稿與保留前快照見 [刪除紀錄](content/algorithms-l6-delete27-20261026.json)。已同步批次查題及投稿查重索引。

## 2026-10-26：第六章決策樹與桶排序勘誤

- 第 34 題（L6-023）：選項 C 的「nl」修正為「n!」，答案由 A、B 改為 A、B、C，移除已解決的辨識提醒。
- 第 17 題（L6-019）：維持 A、C、D，修正解析中沿用其他選項順序的答案說明。
- 保留題目識別碼與題數，其他選項版本的答案維持各自對應順序。
- 前後內容：[勘誤紀錄](content/algorithms-l6-corrections-20261026.json)。
