/* Topic first, then actual answer type. Source question objects and IDs stay intact. */
(() => {
 'use strict';
 const catalogs={
  'os/basics':['作業系統定義與目標','系統組成與硬體資源','開機','中斷','儲存與快取','I/O 與裝置','多處理器','叢集系統','多程式與分時','程序','記憶體','保護與安全','核心資料結構','分散式系統與 P2P','虛擬化','雲端服務','即時系統','開放原始碼'],
  'os/architecture':['使用者介面與系統程式','作業系統服務','系統呼叫與 API','核心結構與設計原則','開機 系統生成與效能分析','Android 與 iOS','Unix / FreeBSD'],
  'os/process':['Process 基礎','PCB / Context Switch','Process State','Scheduler / Queue','CPU / I/O Bound','Process Creation / Termination','Cooperating Process','IPC 基礎','Direct / Indirect Communication','Message Passing','Pipe / Socket','RPC','Mach / Windows IPC','Mobile / Browser'],
  'os/threads':['基本觀念','多執行緒優點','多核心與平行程式設計',"Amdahl's Law",'執行緒模型','執行緒函式庫','Java Threads','OpenMP / Implicit Threading','Grand Central Dispatch','Thread Pools / Server','fork / exec','訊號 / Signals','執行緒取消','Thread-local Storage','Windows Threads','Linux Threads'],
  'os/scheduling':['排程基本觀念','評估指標','FCFS／SJF','RR 時間片','優先權／飢餓','多處理器','即時排程','Linux／Windows／Solaris','排程評估模型','進階排程'],
  'os/treasure':['FCFS／FIFO 計算','SJF／SRTF 計算','Round Robin 計算','優先權排程','Rate Monotonic 即時排程','EDF 即時排程','即時排程可行性'],
  'os/synchronization':['臨界區與核心','同步風險','硬體原子指令','Peterson’s Solution','同步工具','Semaphore','Monitor','經典同步案例','Bounded-Buffer','Readers-Writers','Dining Philosophers','系統實作','替代同步方法'],
  'os/deadlocks':['死結定義與影響','資源類型','死結必要條件','資源分配圖','處理方法總覽','死結預防','死結避免','安全狀態','銀行家演算法','死結偵測','死結恢復','死結偵測與恢復','死結範例'],
  'os/L9':['記憶體保護','位址繫結','連續配置與碎片','非連續配置方式','分頁與 TLB','頁表結構','分段','載入、交換與連結','架構案例：ARM／Intel'],
  'algorithms/L2':['演算法分析 / RAM','漸進符號與定義','單調性','Floor / Ceiling / 模運算','函數增長率 / Log','Iterative Log / Fibonacci','Factorial / Stirling','Insertion Sort','Merge Sort'],
  'algorithms/L3':['基礎觀念','漸進符號','代入法','遞迴樹','大師定理','技術細節','特殊遞迴','綜合方法'],
  'algorithms/L4':['Heap 基礎','Heap 索引','Heap Property','Max-Heapify','Build-Max-Heap','Heapsort','Priority Queue','Heap 效率','Heap 應用'],
  'algorithms/L5':['核心概念','Pivot 與 Partition','遞迴與複雜度','特性與優化'],
  'algorithms/L6':['線性排序與穩定性','比較排序與決策樹','計數排序','基數排序','桶排序'],
  'algorithms/L7':['順序統計量與中位數','最小值與最大值','第二小元素','Partition 分割操作','Randomized-Select','確定性 Select 與中位數的中位數']
 };
 const aliases={
  'os/basics':{'OS 基礎':'作業系統定義與目標','Computer System':'系統組成與硬體資源',Booting:'開機',Interrupt:'中斷',Storage:'儲存與快取','I/O':'I/O 與裝置',Multiprocessing:'多處理器',Cluster:'叢集系統',Multiprogramming:'多程式與分時',Timesharing:'多程式與分時',Process:'程序',Memory:'記憶體',Protection:'保護與安全','Kernel Data Structures':'核心資料結構',P2P:'分散式系統與 P2P',Distributed:'分散式系統與 P2P',Virtualization:'虛擬化',Cloud:'雲端服務','Real-time':'即時系統','Open Source':'開放原始碼'},
  'os/synchronization':{"Peterson's Solution":'Peterson’s Solution'}
 };
 const generic=new Set(['','其他','課程觀念','HTML 匯入','作業系統基礎','作業系統架構','程序與 IPC','執行緒與多執行緒','CPU 排程','L6 · CPU 排程','L8 · 死結','死結','記憶體管理','基礎與漸進分析','LMS 精確格式','堆積、堆積排序與優先佇列','排序演算法','排序基礎','中位數與順序統計量']);
 // Rules are used only for generic import categories, never to replace a custom topic.
 const rules={
  'os/basics':[[/kernel.*data.structur|核心.*資料結構/i,12],[/cloud|雲端/i,15],[/virtuali|虛擬化/i,14],[/cluster|叢集/i,7],[/multiprocess|多處理器|對稱.*非對稱/i,6],[/interrupt|中斷|timer|計時器/i,3],[/bootstrap|boot|開機/i,2],[/cache|storage|儲存|位元|byte|register|暫存器/i,4],[/\bI\/O\b|DMA|裝置|device/i,5],[/protection|security|dual.mode|安全|保護|模式|權限|user.id|group.id/i,11],[/memory|記憶體/i,10],[/multiprogram|timeshar|多程式|分時/i,8],[/process|程序|行程/i,9],[/distributed|network|LAN|WAN|MAN|PAN|peer|分散|網路/i,13],[/real.time|即時/i,16],[/open.source|開源|原始碼/i,17],[/component|組成|硬體|hardware/i,1]],
  'os/architecture':[[/Android|iOS|Dalvik|Cocoa|Aqua|Mac OS X.*GUI/i,5],[/FreeBSD|shell.*fork|shell.*exec|UNIX.*結構|multitasking.*Unix|UNIX kernel/i,6],[/boot|開機|bootstrap|firmware|韌體|crash|dump|損毀|DTrace|profil|效能|tuning|instrument|system.generat/i,4],[/system.call|系統呼叫|API|Win32|POSIX|printf|參數.*傳遞/i,2],[/microkernel|微核心|monolithic|hybrid|混合|分層|layer|module|模組|結構|design|設計|mechanism|policy/i,3],[/CLI|GUI|command.line|shell|interface|使用者介面|system.program|系統程式|指令行|指令列|命令列/i,0],[/service|服務|檔案|資源|protection|protect|保護|security|驗證|Accounting|account management/i,1]],
  'os/process':[[/Mach|LPC|Windows.*IPC/i,12],[/RPC|remote.procedure|遠端程序|stubs?|XDR|XDL/i,11],[/pipe|socket|管道|通訊.*端點/i,10],[/direct.communication|indirect.communication|直接通訊|間接通訊|mailbox|信箱/i,8],[/blocking|non.blocking|rendezvous|阻塞|訊息.*容量|零容量|buffer.*capacit|訊息傳遞/i,9],[/CPU.bound|I\/O.bound|密集|bound.process/i,4],[/fork|exec\(|exit\(|wait\(|parent|child|父程序|子程序|孤兒|殭屍|orphan|zombie|程序.*(?:建立|創建|終止)/i,5],[/PCB|control.block|context.switch|上下文|回傳位址|register|暫存器|堆疊|stack/i,1],[/state|狀態|running|ready|waiting|terminated/i,2],[/schedul|queue|排程|佇列|swapping/i,3],[/cooperat|合作/i,6],[/mobile|browser|Chrome|行動|瀏覽器/i,13],[/IPC|communicat|通訊|shared.memory|共享記憶體/i,7]],
  'os/threads':[[/Amdahl/i,3],[/signal|信號|訊號/i,11],[/cancel|取消/i,12],[/thread.local|TLS|本地儲存/i,13],[/fork|exec/i,10],[/Windows|TEB|ETHREAD|KTHREAD/i,14],[/Linux|clone\(/i,15],[/Grand.Central|GCD|dispatch.queue/i,8],[/thread.pool|執行緒池|server|伺服器/i,9],[/OpenMP|implicit|隱式/i,7],[/many.to|one.to|two.level|多對|一對|兩層|映射|model/i,4],[/Java/i,6],[/library|函式庫|Pthread/i,5],[/parallel|多核心|平行/i,2],[/benefit|優點|responsiv/i,1]],
  'os/scheduling':[[/Solaris|Windows|Linux|SCHED_/i,7],[/evaluat|deterministic.model|simulation|queueing.model|評估|確定性模型|模擬/i,8],[/real.time|EDF|deadline|Rate.Monotonic|即時|截止|期限/i,6],[/affinity|多處理器|multiprocess|load.balanc|負載平衡|migration|遷移|NUMA/i,5],[/Round.Robin|\bRR\b|時間片|time.quantum/i,3],[/multilevel|多層|priority|優先|starvat|飢餓|aging|老化/i,4],[/SJF|SRTF|FCFS|first.come|shortest|短工作|先到先做|burst.*估計|估計.*burst/i,2],[/waiting.time|turnaround|response.time|throughput|utilization|等待時間|迴轉|周轉|回應時間|吞吐|利用率|latency|延遲/i,1]],
  'os/treasure':[[/Rate.Monotonic|rate.monotonic|\bRM\b|單調速率/i,4],[/Earliest.Deadline|\bEDF\b/i,5],[/Round.Robin|\bRR\b|time.quantum/i,2],[/SJF|SRTF|shortest/i,1],[/FCFS|FIFO|first.come/i,0],[/priority|優先權/i,3],[/deadline|schedulab|feasib|可行性|即時/i,6]],
  'os/synchronization':[[/Peterson/i,3],[/test.and.set|compare.and.swap|CAS|原子.*指令/i,2],[/bounded.buffer|buffer.*problem|有界緩衝|界限緩衝|生產者|消費者/i,8],[/readers.writers|讀者|寫者/i,9],[/philosopher|哲學家|chopstick|筷子/i,10],[/monitor|監視器/i,6],[/semaphore|信號量|訊號量/i,5],[/Linux|Windows|Java|futex/i,11],[/transaction|memory.transaction|functional|功能式|功能性|immutable|不可變/i,12],[/critical.section|臨界區|progress|bounded.waiting|有限等待/i,0],[/race|競爭|inversion|反轉|deadlock|死結|starvat|飢餓|livelock|活鎖/i,1],[/mutex|spinlock|互斥鎖|自旋/i,4]],
  'os/deadlocks':[[/Banker|銀行家|Need|Allocation|Available|Max.*矩陣/i,8],[/safe.sequence|safe.state|unsafe|安全序列|安全狀態|不安全/i,7],[/resource.allocation.graph|wait.for|資源分配圖|等待圖|request.edge|assign.*edge/i,3],[/recover|恢復|rollback|回滾|victim|犧牲|process.termination/i,10],[/prevent|預防|打破|破壞/i,5],[/avoidance|避免/i,6],[/detect|偵測/i,9],[/necessary.condition|必要條件|hold.and.wait|circular.wait|mutual.exclusion|no.preemption|佔用與等待|循環等待|無搶佔|互斥/i,2],[/philosopher|哲學家|場景|範例|文件鎖|檔案鎖/i,12],[/resource.type|資源類型/i,1],[/method|策略|處理方法|handling/i,4]],
  'os/L9':[[/ARM|Intel|x86|PAE/i,8],[/dynamic|swapping|stub|動態|交換|載入|連結/i,7],[/segment|分段/i,6],[/inverted|hashed|hierarch|倒置|雜湊|分層.*頁|頁表結構/i,5],[/TLB|page.number|page.offset|頁號|偏移|frame|分頁/i,4],[/fragment|contiguous|compaction|碎片|連續|壓縮/i,2],[/binding|繫結|綁定|absolute|relocat/i,1],[/base|limit|protection|保護|合法/i,0]],
  'algorithms/L2':[[/Stirling|factorial|n!|階乘|史特林/i,6],[/Fibonacci|費氏|Iterative|lg\*|重複對數/i,5],[/Insertion|插入排序/i,7],[/Merge|合併排序|2T\(n\/2\)/i,8],[/monoton|單調|f\(m\)/i,2],[/floor|ceiling|地板|樓板|天花板|模運算|modulo|mod n/i,3],[/RAM|analyz|資源|分析.*(?:目的|時間|空間)|分治法|worst.case|最壞情況.*原因/i,0],[/asymptot|漸進|Θ|Ω|上界|下界|O\(|o\(|ω\(|對稱/i,1],[/log|lg|對數|指數|多項式|exponen/i,4]],
  'algorithms/L3':[[/n\/2\s*\+\s*17|sqrt|平方根|T\(n.?1\)|特殊|變數變換/i,6],[/Master|大師|主定理|Case\s*[123]/i,4],[/substitut|代入|induct|歸納/i,2],[/floor|ceiling|取整|技術細節|邊界/i,5],[/tree|遞迴樹|葉節點|層.*成本/i,3],[/漸進符號|Θ.*Ω|上界.*下界/i,1],[/方法/i,7]],
  'algorithms/L4':[[/Build.Max.Heap|建立.*堆積|建堆/i,4],[/Heapify/i,3],[/Heapsort|堆積排序/i,5],[/priority.queue|優先佇列|Extract.Max|Increase.Key|Insert|Underflow/i,6],[/索引|index|parent|left|right|父節點/i,1],[/property|性質|最小.最大|Min.Max|合法|正確.*heap/i,2],[/應用|application/i,8],[/效率|complexity|複雜度/i,7]],
  'algorithms/L5':[[/partition|pivot|樞紐|基準|exchange|指標/i,1],[/複雜度|recurr|遞迴|深度|最差|最好|最壞|平均.*時間/i,2],[/優化|效能|改進|stable|穩定|in.place|原地|優點|缺點|比較/i,3]],
  'algorithms/L6':[[/COUNTING|計數排序/i,2],[/RADIX|基數/i,3],[/BUCKET|桶排序/i,4],[/decision.tree|決策樹|comparison|比較排序|下界|葉節點/i,1]],
  'algorithms/L7':[[/第二小|second.smallest/i,2],[/最大值|最小值|GET_MIN_MAX|minimum|maximum/i,1],[/median.of.median|中位數的中位數|Deterministic|確定性|3n\/10|7n\/10|每組五|分成.*組/i,5],[/Randomized|Quickselect|中位數選擇法/i,4],[/Partition|分割操作/i,3]]
 };
 const cache=new WeakMap(),views=new WeakMap();
 function topic(question,course,unit){
  const key=course+'/'+unit,raw=String(question.category??'').trim(),stem=String(question.stem??question.q??'');
  const old=cache.get(question);if(old?.key===key&&old.raw===raw&&old.stem===stem)return old.result;
  const names=catalogs[key]??[],alias=aliases[key]?.[raw];let label=alias||raw;
  if(!alias&&generic.has(raw)){
   const found=rules[key]?.find(([pattern])=>pattern.test(stem));
   const fallback={'os/basics':0,'os/architecture':1,'os/process':0,'os/threads':0,'os/scheduling':0,'os/treasure':6,'os/synchronization':4,'os/deadlocks':0,'os/L9':3,'algorithms/L2':0,'algorithms/L3':0,'algorithms/L4':0,'algorithms/L5':0,'algorithms/L6':0,'algorithms/L7':0};
   label=names[found?.[1]??fallback[key]]||raw||'其他主題';
  }
  const result={label,rank:names.includes(label)?names.indexOf(label):names.length};cache.set(question,{key,raw,stem,result});return result;
 }
 function view(question,course,unit){
  const {label}=topic(question,course,unit);if(label===question.category)return question;
  const old=views.get(question);if(old?.label===label)return old.question;
  const copy={...question,category:label};views.set(question,{label,question:copy});return copy;
 }
 function typeRank(q){const type=window.courseQuestionTools.answerType(q);return type==='單選題'?0:type==='多選題'?1:2;}
 function sort(entries,course,unitRank,legacyRank=entry=>entry.i??0){
  const decorated=entries.map((entry,index)=>({entry,index,topic:topic(entry.q,course,entry.unit.id),type:typeRank(entry.q),unit:unitRank(entry),legacy:legacyRank(entry)}));
  decorated.sort((a,b)=>a.unit-b.unit||a.topic.rank-b.topic.rank||(a.topic.label===b.topic.label?0:a.topic.label.localeCompare(b.topic.label,'zh-Hant'))||a.type-b.type||a.legacy-b.legacy||a.index-b.index);
  const numbers=new Map();return decorated.map(({entry,topic})=>{entry.topicLabel=topic.label;const n=(numbers.get(entry.unit.id)??0)+1;numbers.set(entry.unit.id,n);entry.displayNumber=n;return entry;});
 }
 (typeof window==='undefined'?globalThis:window).courseTopicOrder={topic,view,typeRank,sort,catalogs};
})();
