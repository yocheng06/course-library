import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const explanations = {
  '4a23f59b-11': '先把鍵 k 送進雜湊函數 h，再用 h(k) 決定表的位置。鏈結串列用來保存落在同一桶的資料；探測序列是碰撞後依序檢查的位置；排序則負責排列資料。',
  '4a23f59b-12': '乘法雜湊先乘常數 A、取小數部分，再乘表長向下取整。常用 A=(√5−1)/2，約 0.618，符合 0<A<1。若用 0、1 或 2，整數鍵乘完仍是整數，小數部分都為 0。',
  '4a23f59b-13': '除法雜湊用 k mod m。若鍵常有共同因數，而 m 也含這個因數，餘數容易只落在少數槽。選適當質數能減少這種規律造成的碰撞；仍需看鍵的分布，質數也不會自行增加記憶體或降低搜尋速度。',
  '4a23f59b-15': '好的雜湊函數把鍵均勻分散，讓碰撞、桶長和探測次數降低，且每次算索引應夠快。可以使用取餘數、乘法或位元運算，沒有只能用加法的限制。',
  '4a23f59b-16': '負載因子 α=n/m。n 是表內已存的鍵數，m 是表的槽數。例如 11 格放了 9 個鍵，α=9/11，因此分子填 n。',
  '4a23f59b-17': '均勻分布能讓資料分散到各槽，避免所有鍵擠到一處。探測次數和鏈結串列長度是碰撞分布與處理方式的結果；記憶體大小會影響容量，也需要配合分布與負載。',
  '4a23f59b-19': 'h(k)=k mod m 只看餘數。若 m=8 而鍵全是 8 的倍數，便都落在 0。選不容易與鍵規律共用因數的質數，可減少週期性集中和碰撞；取模運算本身未必更快。',
  '4a23f59b-20': '將 n 個元素平均分到 m 個槽，每槽平均 n/m 個，例如 10 個元素和 5 格的負載是 2。m/n 是其倒數，相加或相乘也沒有表示每槽平均值。',
  '4a23f59b-3': '若不同鍵 k₁、k₂ 得到同一索引 h(k₁)=h(k₂)，就發生碰撞。表還有空格也可能碰撞，且同一個鍵得出相同索引本來就是確定性函數的結果。碰撞由鏈結或探測處理。',
  '4a23f59b-4': '先從函數族隨機選 h。對任兩個不同的鍵，其碰撞機率可由函數族的性質約束，典型上界是 1/m。碰撞仍可能發生，表也必須配置空間並計算雜湊函數。',
  '4a23f59b-5': '鍵值空間（key space）能提供的鍵比槽數多。把所有可能的鍵分配到較少的槽，依鴿籠原理，至少有兩個不同鍵對到同一個槽。因此填 key。',
  '4a23f59b-7': '在雜湊分布近似均勻、負載受控制時，平均只需檢查常數個位置或元素，因此填 O(1)。若資料集中到同一桶，仍可能要逐一搜尋，最壞情況可為 O(n)。',
  '4a23f59b-9': '第二個函數決定步長，讓起始槽相同的鍵也可能走不同路徑，減輕二次群聚。步長與表長互質時，探測可走遍整張表。使用兩個函數是這個方法的做法；額外計算則是成本。',
  '195e73dc-10': '線性探測先用鍵決定起點，碰撞後固定每次前進一格，屬開放定址法。連續佔用區會吸收更多插入，形成一次群聚；α 接近 1 時空槽稀少，探測變長。若「探測序列與關鍵字有關」指起點則有關，本題答案採的是碰撞後位移規則固定的讀法。',
  '195e73dc-11': '先算 kA，再取 kA mod 1 的小數部分，乘上 m 後向下取整。這是乘法雜湊。除法法取的是 k mod m；直接定址用鍵直接定位；全域雜湊則描述如何選函數。',
  '195e73dc-12': '直接定址替每個可能的鍵預留一格，因此空間大小取決於整個 U，而非只取決於已存的鍵數。U 小時才適合；資料是否排序或均勻分布不會減少這筆空間需求。',
  '195e73dc-13': '符號表、以鍵查找的快取、以及編譯器用變數名稱找屬性，都需要依鍵存取。雜湊表適合這些查找；若要按大小排序二維陣列，雜湊索引不會提供鍵的順序。',
  '195e73dc-14': 'quadratic 表示二次。典型位移是 c₁i+c₂i²，辨認點是 i² 項。題目以 i² 表示簡式；一般二次探測也可以同時有線性項。',
  '195e73dc-15': '開放定址搜尋遇到從未使用的空槽會停止。如果刪除時直接清空，後面因碰撞而移到其他槽的鍵可能找不到。留下「已刪除」標記可讓搜尋繼續，插入時則可重用該槽。',
  '195e73dc-16': '鏈結法把碰撞的鍵放在同一桶內；開放定址依探測序列另找位置。完全雜湊可為固定鍵集合建立無碰撞查找，典型二層設計會在碰撞的桶內配置次級表。直接定址每個鍵各一格，是用空間避開雜湊碰撞的另一種設計。',
  '195e73dc-2': '鏈結法需要節點與指標，同一桶可放多個鍵，所以 α 可以大於 1。開放定址把元素留在表內，省掉每個節點的指標，但仍要預留空槽，而且刪除通常需要標記，操作反而較複雜。',
  '195e73dc-3': '除法雜湊把 k 除以 m，將餘數用作索引，所以空格填 mod。例如 22 mod 11=0，應檢查第 0 格。',
  '195e73dc-4': '線性探測發生碰撞後往下一格尋找空槽，所有鍵都留在原表內。鏈結串列常用於鏈結法；二元樹是一種資料結構；桶排序的目的是排序。',
  '195e73dc-5': '二次探測以 c₁i+c₂i² 產生偏移，最具辨識力的是 i²。單獨使用 i 是線性位移；i³ 是三次；log i 不是這個公式。',
  '195e73dc-6': '碰撞解法與雜湊分布都會影響成本。對均勻雜湊的鏈結法，平均桶長為 α，搜尋平均 O(1+α)；若允許直接插到串列開頭，插入 O(1)。開放定址或需要先檢查重複時，插入成本仍會受負載影響。',
  '195e73dc-8': '開放定址每格最多一個鍵，所以 n≤m，亦即 α≤1。α=1 表已滿，不能再插入，實務常在 α 明顯低於 1 時擴容。',
  '276edad2-2': 'h(k)=k mod m 是除法雜湊法。開放定址說明發生碰撞後如何處理，與初始索引的計算法不同。乘法法取 kA 的小數部分，全域雜湊則從函數族中隨機選函數。',
  '276edad2-3': '鏈結法把落到同一索引的鍵放在同一桶的串列裡，再依鍵比對。二元搜尋需有序資料，快速排序負責排列，動態規劃重用子問題結果，都不是本題的碰撞解法。',
  '276edad2-5': '完全雜湊為固定的鍵集合建表。典型二層完全雜湊先計算第一層桶，再查第二層槽並比對鍵，只需固定次數，因此最壞搜尋 O(1)。建表成本與更新成本要另外算。',
  '276edad2-6': '雙重雜湊的公式是 (h₁(k)+i×h₂(k)) mod m。h₁ 決定起點，h₂ 決定此鍵的步長，i 是探測次數。選項的 h²(k) 依題意是在指第二個函數 h₂(k)；加 i 是線性探測，加 i² 是二次位移。',
  '276edad2-7': 'universe 是所有可能輸入鍵的集合，通常寫 U。表內當下實際存放的鍵只是 U 的一部分。例如鍵可為所有學號，表內只有這堂課學生的學號。',
  '10a5c455-2': 'α=n/m，表示把表內鍵數平均分到每個槽的數量。鏈結法允許每個槽接多個鍵，所以可超過 1。開放定址最多 α=1，但滿表時已不能插入；題庫的「小於 1」應讀為仍可插入、正常維持負載的條件。',
  '10a5c455-3': '字典運算包括依鍵搜尋、插入與刪除。雜湊分布合理且負載受控時，這些操作可達平均常數時間。排序需處理次序，圖形搜尋與樹遍歷需依結構走訪，不能靠一次雜湊完成。',
  '10a5c455-4': 'm 是槽數。取餘數會把鍵分配到 0～m−1，所以 m 會影響分布，可選合適的質數。鍵值範圍可以遠大於 m；雜湊正是把大鍵值空間映射到較小的表。',
  '10a5c455-5': '所有鍵都落在同一桶時，該桶串列長度為 n。最壞要檢查整條串列，例如找不存在的鍵，成本為 Θ(n)。資料沒有排序或樹結構，無法做二分搜尋。',
  '10a5c455-6': '下一槽是 (目前槽+1) mod m。例如從第 m−1 格往前一格會繞回第 0 格。加平方位移屬二次探測，使用第二雜湊函數決定步長則是雙重雜湊。',
  'f9039e48-1': '建表時從全域函數族隨機選一支函數。對任意事先固定的一組輸入，平均是對「隨機選函數」取期望，因此可降低特定輸入造成大量碰撞的風險。這個性質不需要把整個鍵值空間存起來，也不保證每次選出的函數都同樣均勻。',
};

const topicGroups = [
  ['雜湊基本觀念與應用',['4a23f59b-11','4a23f59b-3','4a23f59b-5','195e73dc-12','195e73dc-13','276edad2-7','10a5c455-3']],
  ['雜湊函數與設計',['4a23f59b-12','4a23f59b-13','4a23f59b-15','4a23f59b-19','195e73dc-11','195e73dc-3','276edad2-2','10a5c455-4']],
  ['負載因子與效能',['4a23f59b-16','4a23f59b-17','4a23f59b-20','4a23f59b-7','195e73dc-6','10a5c455-2']],
  ['碰撞處理與鏈結法',['195e73dc-16','195e73dc-2','276edad2-3','10a5c455-5']],
  ['開放定址法',['195e73dc-15','195e73dc-4','195e73dc-8']],
  ['線性探測',['195e73dc-10','10a5c455-6']],
  ['二次探測',['195e73dc-14','195e73dc-5']],
  ['雙重雜湊',['4a23f59b-9','276edad2-6']],
  ['全域雜湊與完全雜湊',['4a23f59b-4','276edad2-5','f9039e48-1']],
];
const topicById = new Map(topicGroups.flatMap(([topic,ids])=>ids.map(id=>[id,topic])));
const topicRank = topic=>topicGroups.findIndex(([name])=>name===topic);
const typeRank = type=>['單選題','多選題','填空題'].indexOf(type);

function compute(q) {
  const keys=q.q.match(/將鍵值 (.*?) 插入/)?.[1].split('、').map(Number);
  const m=Number(q.q.match(/m\s*=\s*(\d+)/)?.[1]);
  assert.ok(keys?.every(Number.isInteger)&&m>0);
  const double=q.q.match(/h2\(k\)\s*=\s*(\d+)\s*\+/i);
  const quadratic=q.q.match(/c1\s*=\s*(\d+)\s*與\s*c2\s*=\s*(\d+)/i);
  const offset=(k,i)=>double?i*(Number(double[1])+k%(m-1)):quadratic?Number(quadratic[1])*i+Number(quadratic[2])*i*i:i;
  const formula=double?`(k + i×(${double[1]} + (k mod ${m-1}))) mod ${m}`:quadratic?`(k + ${quadratic[1]}i + ${quadratic[2]}i²) mod ${m}`:`(k + i) mod ${m}`;
  const table=Array(m).fill(null),traces=[],failed=[];
  for(const key of keys){
    const attempted=[];let placed=false;
    for(let i=0;i<m;i++){
      const index=(key+offset(key,i))%m;
      attempted.push(index);
      if(table[index]===null){table[index]=key;placed=true;break;}
    }
    if(!placed)failed.push(key);
    const unique=[...new Set(attempted)].join(' → ');
    traces.push(placed?`${key}：${unique}`:`${key}：探測 ${unique}，i=0～${m-1} 都找不到空槽`);
  }
  const parts=[`依插入順序逐一處理。索引用 ${formula}，每個鍵都從 i=0 開始，遇到已佔槽便增加 i。`,`每個鍵的探測位置如下。若成功，箭頭最後一格就是插入位置。\n${traces.join('\n')}`,`由 A[0] 到 A[${m-1}] 依序為 ${table.map(v=>v??'空').join('、')}。`];
  let calculated;
  if(q.opts.length){
    const matches=q.opts.map(text=>{
      const pair=text.match(/A\[(\d+)\]\s*=\s*(-?\d+)/i);
      assert.ok(pair,text);
      return {text,index:Number(pair[1]),actual:table[Number(pair[1])],expected:Number(pair[2])};
    });
    parts.push(matches.map(option=>option.actual===option.expected?`${option.text} 正確。`:`${option.text} 不成立，A[${option.index}] 實際為 ${option.actual??'空'}。`).join(''));
    calculated=matches.flatMap((option,i)=>option.actual===option.expected?[String.fromCharCode(65+i)]:[]).join('');
  }else if(/無法藉此公式/.test(q.q)){
    calculated=failed.sort((a,b)=>a-b).join('/');
    parts.push(`依小到大填 ${calculated}。步長為 ${m} 時，每次取模都回到同一格，表裡即使還有空槽也無法探測到。`);
  }else{
    const indices=[...q.q.matchAll(/A\[(\d+)\]\s*=\s*_{3,}/g)].map(match=>Number(match[1]));
    assert.ok(indices.length,q.q);
    calculated=indices.map(i=>table[i]).join('/');
    parts.push(`依填空順序取值：${indices.map(i=>`A[${i}]=${table[i]??'空'}`).join('，')}。`);
  }
  const expected=q.opts.length?q.a.match(/[A-H]/gi)?.join(''):q.a.replace(/\s+/g,'');
  const discrepancy=calculated!==expected;
  if(discrepancy)parts.push(`依題面公式重算為 ${calculated}，與現有題庫答案 ${q.a} 不一致。保留原答案供核對，請確認原題的公式或答案設定。`);
  return {explanation:parts.join('\n\n'),discrepancy,calculated,category:double?'雙重雜湊':quadratic?'二次探測':'線性探測'};
}

const url='https://course-library-submissions.orange06.workers.dev/api/questions?course=algorithms';
const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
assert.ok(response.ok,`公開題庫 HTTP ${response.status}`);
const data=await response.json();
const items=data.questions.filter(row=>row.unit==='L9').map(({question:q})=>{
  const id=q.bookmarkId||q.id;
  const short=id.replace('community-','').slice(0,8)+id.slice(id.lastIndexOf('-'));
  const verified=q.q.startsWith('考慮將鍵值')?compute(q):{explanation:explanations[short],discrepancy:false,category:topicById.get(short)};
  assert.ok(verified.explanation,`缺少解析：${id}`);
  assert.ok(verified.category && typeRank(q.type)>=0,`缺少主題或題型：${id}`);
  return {id,stem:q.q,type:q.type,options:q.opts,answer:q.a,previousExplanation:q.ex||'',previousCategory:q.category,...verified};
});
items.sort((a,b)=>topicRank(a.category)-topicRank(b.category)||typeRank(a.type)-typeRank(b.type));
assert.equal(new Set(items.map(item=>item.id)).size,items.length);
const summary={fetchedAt:new Date().toISOString(),source:url,course:'algorithms',unit:'L9',questions:items};
await writeFile(new URL('./algorithm-l9-explanations-draft.json',import.meta.url),JSON.stringify(summary,null,2)+'\n','utf8');
const markdown=['# 演算法 L9 雜湊題庫解析草稿','',`共 ${items.length} 題。按主題分組，每組依單選、多選、填空排列，同主題同題型保留原相對順序。草稿未寫入網站。`,'',...items.flatMap((q,i)=>[
  ...(items[i-1]?.category!==q.category?[`## ${q.category}`,'']:[]),
  `### 第 ${i+1} 題 · ${q.type} · ${q.id}`,'',q.stem,'',...q.options.map((option,j)=>`- ${String.fromCharCode(65+j)}. ${option}`),'',`題庫答案：${q.answer}`,'',q.explanation,''])].join('\n');
await writeFile(new URL('./algorithm-l9-explanations-draft.md',import.meta.url),markdown,'utf8');
console.log(JSON.stringify({questions:items.length,topics:topicGroups.map(([topic])=>[topic,items.filter(q=>q.category===topic).length]),computed:items.filter(item=>item.calculated!==undefined).length,discrepancies:items.filter(item=>item.discrepancy).map(({id,answer,calculated})=>({id,answer,calculated}))}));
