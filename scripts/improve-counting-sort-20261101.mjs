import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {parseHTML} from 'linkedom';
import assert from 'node:assert/strict';
import '../assets/choice-answers.js';

export function traceCounting(A,k=5){
  assert(A.length&&A.every(x=>Number.isInteger(x)&&x>=0&&x<=k));
  const frequency=Array(k+1).fill(0);for(const x of A)frequency[x]++;
  const C=frequency.map((_,x)=>frequency.slice(0,x+1).reduce((a,b)=>a+b,0));
  const prefix=[...C],B=Array(A.length).fill(null),states=[{B:[...B],C:[...C]}],steps=[];
  for(let j=A.length;j>=1;j--){const x=A[j-1],position=C[x];assert(position>=1&&position<=A.length&&B[position-1]===null);B[position-1]=x;C[x]--;steps.push({j,x,position,before:position,after:C[x]});states.push({B:[...B],C:[...C]});}
  return {A,k,frequency,prefix,states,steps};
}
const checkpoints={'L6-028':0,'L6-063':4,'L6-047':6,'L6-065':7,'L6-066':11,'L6-021':0,'L6-022':3,'L6-052':11,'L6-042':15};
export const identity=q=>JSON.stringify([q.type||'',q.q??q.stem??'',q.opts??q.options??[],q.a??q.answer??'',q.images||[]]);
const bare=o=>o.replace(/^[A-H][.、．:：]\s*/,'');
function computation(q){
  const A=(q.q??q.stem).match(/A陣列的內容為\s*([0-9][0-9,\s]*)/)?.[1].trim().split(',').map(Number);
  const data=traceCounting(A),target=checkpoints[q.bookmarkId],state=data.states[target];assert(state,'Unknown checkpoint '+q.bookmarkId);
  const answer=(q.a??q.answer).split('/').map(s=>s.trim().split(',').map(Number));
  assert.deepEqual(answer,[state.B.map(x=>x??0),state.C],q.bookmarkId+' teacher answer');
  const {frequency,prefix,steps}=data,n=A.length;
  const fill=target===n?'演算法已執行完，所有元素都已回填。':target===0?'第 9 行迴圈還沒開始，尚未執行任何一次第 10、11 行。':`目前 j＝${n-target}，表示這一輪剛走到第 9 行，尚未執行第 10、11 行。只做完 j＝${n} 到 j＝${n-target+1}，共 ${target} 次回填；A[${n-target}]＝${A[n-target-1]} 還沒有放進 B。`;
  const counts=frequency.map((f,x)=>`${x} 出現在 ${A.flatMap((v,i)=>v===x?[`A[${i+1}]`]:[]).join('、')||'沒有任何位置'}，所以「恰好等於 ${x}」有 ${f} 個。`).join('\n');
  const sums=prefix.map((v,x)=>x===0?`C[0]＝${frequency[0]}。`:`C[${x}]＝前面小於等於 ${x-1} 的 ${prefix[x-1]} 個＋恰好等於 ${x} 的 ${frequency[x]} 個＝${v}。`).join('\n');
  const stepLine=s=>`j＝${s.j}：讀 A[${s.j}]＝${s.x} → 查 C[${s.x}]＝${s.before} → 第 10 行寫 B[${s.position}]＝${s.x} → 第 11 行把 C[${s.x}] 減成 ${s.after}。其他 C 格子不動。`;
  const first=steps[0];
  const zeros=state.B.flatMap((v,i)=>v===0?[i+1]:[]),empty=state.B.flatMap((v,i)=>v===null?[i+1]:[]);
  const meaning=target===n?`全部回填後，C[x] 等於原陣列中「嚴格小於 x」的元素個數。例如 C[0]＝0，不是原陣列沒有 0，而是沒有比 0 更小的元素。`:'累積完成、尚未回填時，C[x] 才表示「小於等於 x 的總數」。回填開始後，每放入一個 x，C[x] 就減 1；若後面還有 x，這個數就是下一個 x 要寫入的 B 位置。不要把這時的 C 當成原始出現次數。';
  return {explanation:`① 先分清楚三個陣列\nA 是原始資料，不會在這個版本裡被改寫。B 是排序結果；B[1] 是最左邊第 1 格。C 用「數值」當索引：C[3] 問的是數字 3，不是 A 的第 3 個元素。\n本題 n＝${n}；A、B 索引為 1～${n}，C 索引為 0～5。\n\n② 第 3、4 行：先數每個值有幾個\n${counts}\n因此次數表（依數值 0、1、2、3、4、5）：${frequency.join(',')}。\n\n③ 第 6、7 行：把次數變成「最後可放的位置」\n${sums}\n累積後 C＝${prefix.join(',')}。例如 C[3]＝${prefix[3]}，表示共有 ${prefix[3]} 個元素小於等於 3，所以最右邊那個 3 應放 B[${prefix[3]}]。C[3] 的內容是位置數字，不是要填進 B 的值。\n\n④ 先認準這題的停止時點\n${fill}\n\n⑤ 第 10、11 行：每一輪只做這兩件事\n先寫 B[C[A[j]]]＝A[j]，再把 C[A[j]] 減 1。一定先用原本的 C 決定位置，再遞減；不能先減再放。\n${target?steps.slice(0,target).map(stepLine).join('\n'):`本題此時不做回填。若按「下一步」示範第一輪，才會發生：${stepLine(first)}這是停止時點之後的動作，不能把它算進本題答案。`}\n\n⑥ 整理本題要填的 B 與 C\nB＝${state.B.map(x=>x===null?'—':x).join(',')}。\n${empty.length?`尚未寫入的是 B[${empty.join(']、B[')}]，上方演示用「—」標出。題庫填答約定把這些空格記為 0；這不代表程式已經把數字 0 寫進去。`:'B 的每格都已實際寫入，不再有空格。'}\n${zeros.length?`真正寫入數字 0 的格子是 B[${zeros.join(']、B[')}]。`:''}\n因此第一格填 ${state.B.map(x=>x??0).join(',')}；第二格填 ${state.C.join(',')}。兩個填空依題庫用 / 分隔，完整答案保留為 ${q.a??q.answer}。\n\n⑦ 為什麼最後／中途的 C 不是一開始那一串\n${meaning}\n\n本題版本條件：輸入含 0，因此驗算採 C[0..5] 全部初始化，累積由 i＝1 開始。若原題程式列出 i＝1 初始化、i＝2 累積，會漏掉 0；這裡只在解析標明計算條件，原題文字與答案都保留。`,walkthrough:{...data,target,title:`${n} 個元素：${target===n?'全部完成':target===0?'回填前':`j＝${n-target} 這輪開始前`}`}};
}
function theory(q){
  const id=q.bookmarkId,opts=q.opts??[],key=opts.length?globalThis.courseChoiceAnswers.expectedChoiceKey(q.a,opts):'';
  const intro={
    'L6-014':'把 C 想成每種數字的登記表。例：A＝[2,0,2,1]，數完得到 C[0..2]＝[1,1,2]，表示 0 有 1 個、1 有 1 個、2 有 2 個。累加後變成 [1,2,4]，表示小於等於 0、1、2 的數分別有 1、2、4 個。回填時 C 又會隨使用而遞減，所以一定先看演算法做到哪個階段。',
    'L6-062':'本題依題庫既有條件，問的是「累積計數已做完、尚未開始回填」的 C[i]。例如 A＝[2,0,2,1]，累積後 C＝[1,2,4]；C[1]＝2，因為 0 和 1 這兩個元素都小於等於 1。若只數等於 1 的次數，才會得到 1，那是累積前的表。',
    'L6-017':'先看題目在強調哪一塊空間。計數表 C 要替 0～k 每種數字留一格，所以有 k＋1 格，為 Θ(k)；範圍越大，C 越大。輸出 B 另外需要 n 格。因此本題答案強調計數表取決於 k；若問整個穩定版本的輔助空間，必須回答 Θ(n＋k)，不能說 n 完全不影響。',
    'L6-026':'把四段工作分開算：初始化 C 要 k 格 → Θ(k)；掃描 A 計數要 n 次 → Θ(n)；累積 C 要 k 次 → Θ(k)；由右往左回填 B 要 n 次 → Θ(n)。加起來 Θ(k＋n＋k＋n)＝Θ(n＋k)。迴圈是一段接一段，不能把 n 和 k 相乘。',
    'L6-040':'課本基本版本直接用鍵值存取 C[x]，因此 x 要是已知有限範圍的整數索引。例如數字 3 放到 C[3]；任意實數 3.7 不能直接當陣列下標。更一般的資料可以先取出／轉換整數鍵值，但那是額外的前處理，不是直接把任何物件都交給基本版本。',
    'L6-054':'先寫出一般式 Θ(n＋k)。k＝O(n) 表示存在固定常數 c，使得 k 不超過 c×n。於是 n＋k 不超過 (1＋c)n；另一方面掃描全部輸入至少要 n 次，所以總時間同時有線性上界與線性下界，得到 Θ(n)。不是看到兩個迴圈就相乘成 n²。',
    'L6-009':'演算法有三個不同角色：陣列 A 是題目給的原始資料；陣列 B 是新建的排序結果；陣列 C 是新建的計數／位置表。因此「輔助陣列」是 B 與 C，A 不算額外建立。選項代號和陣列名稱是不同東西：例如選項 C 的內容可能才是「陣列 B」，判斷要看內容。',
    'L6-031':'Counting Sort 用範圍換取速度。若只有 3 筆資料，最大鍵值卻是 10 億，基本版本仍要處理約 10 億格 C，通常非常浪費。它適合鍵值範圍受控的整數資料；一般浮點數與極少記憶體，都不適合直接套這個版本。',
    'L6-064':'特性要連同條件一起看：時間一般是 Θ(n＋k)，只有 k＝O(n) 才能說對 n 是線性；C 本身占 Θ(k)，加上 B 才是 Θ(n＋k)；標準「由右往左讀 A、先放入 B 再遞減 C」的版本是穩定排序。例：A 中兩個 2 分別標為 2甲、2乙，乙先被放到較右邊，甲後來放到左邊，結果仍是甲在乙前。',
    'L6-008':'第 1、2 行初始化計數表，需要 Θ(k)；第 3、4 行掃描 n 個輸入，需要 Θ(n)；第 6、7 行累加 C，需要 Θ(k)；第 9～11 行回填 n 次，需要 Θ(n)。四段先後執行，總時間 Θ(k＋n＋k＋n)＝Θ(n＋k)。題目要求的英文格式是 big-theta(n+k)，保留小寫與括號；不是只填 O(n)，也不是把相鄰迴圈的成本相乘。'
  }[id];assert(intro,id);
  const reason=text=>{
    const s=bare(text);
    if(id==='L6-009'){if(/(?:^|陣列\s*)B\s*[（(]/.test(s))return 'B 是存放排序結果的額外陣列。';if(/(?:^|陣列\s*)C\s*[（(]/.test(s))return 'C 是記錄次數與位置的額外陣列。';if(/輸入|^A\s*\(/.test(s))return '這是原本輸入 A，不是演算法額外建立的輔助表。';return '課本這個版本沒有建立陣列 D，也沒有用遞迴表。';}
    if(/指標/.test(s))return 'C 的每格存整數計數／位置界線，不是記憶體指標。';
    if(/樞紐/.test(s))return '樞紐是快速排序等方法的角色，計數排序沒有挑 pivot。';
    if(/原始資料/.test(s))return '原始資料在 A；C 不會把 A 的全部元素依原順序再存一遍。';
    if(/次數|累積計數|小於或等於|累積位置|鍵值次數/.test(s))return '符合這一階段 C 所記錄的計數資訊。';
    if(id==='L6-062'&&/位置/.test(s))return 'C[i] 此時是累積總數，也是值 i 所占區段的右界；不是第 i 個輸入元素的單一位置。';
    if(id==='L6-062')return 'i 是數值索引，C[i] 不是把數字 i 自己存進去。';
    if(/深度|高度/.test(s))return '這個版本沒有遞迴呼叫或樹結構，空間不由這些量決定。';
    if(/參數 k|數值範圍|值域/.test(s))return id==='L6-031'?'k 很大時，初始化、累積與存放 C 都很昂貴。':'C 必須涵蓋整個鍵值範圍，所以大小直接隨 k 增加。';
    if(/輸入長度/.test(s))return 'n 確實影響輸出 B 的大小，但本題單選著重的是計數表 C 的範圍 k；若問總空間就要同時算 n＋k。';
    if(/記憶體/.test(s))return '需要額外的 C 與輸出 B，記憶體很有限時不適合。';
    if(/負數/.test(s))return '基本版本不直接使用負下標；先平移鍵值可處理負整數，但那是另外調整過的版本。';
    if(/浮點|實數/.test(s))return '任意實數不能直接作為離散陣列下標；須先有額外的轉換與範圍條件。';
    if(/字串|結構體/.test(s))return '這不是基本版本可直接拿來存取 C[x] 的有界整數鍵。';
    if(/整數/.test(s))return id==='L6-031'?'有界整數正是適用條件，本身不是「不適合」的原因。':'有界整數可以直接對應計數表下標，符合基本版本的要求。';
    if(/O\(k\)/.test(s))return '這描述計數表 C 的額外空間；計入輸出 B 的總輔助空間仍是 Θ(n＋k)。';
    if(/穩定/.test(s))return '由右往左處理相同鍵值，先把後出現者放到右側，保留原本的相對順序。';
    if(/線性/.test(s))return '要加上 k＝O(n) 的條件；一般式是 Θ(n＋k)。';
    if(/n\s*\+\s*k/.test(s))return '同時計入掃描 n 筆資料與處理 k 種鍵值的成本。';
    if(/n\^?2|n²/.test(s))return '沒有對所有輸入做雙層兩兩比較；這裡把先後執行的成本相加。';
    if(/log/.test(s))return '這個流程沒有比較排序的對數分割；仍須掃描 n 筆資料，不能只有 log n，也不需要乘上 log n。';
    return '與上方成本推導相符：k＝O(n) 後，Θ(n＋k) 簡化為 Θ(n)。';
  };
  return {explanation:`核心觀念：\n${intro}\n\n${opts.length?'選項判讀：\n'+opts.map((o,i)=>`${String.fromCharCode(65+i)}．${bare(o)}：${key.includes(String.fromCharCode(65+i))?'選這項。':'不選。'}${reason(o)}`).join('\n'):'填答格式：\n'+q.a}\n\n本題答案：${q.a}。`,walkthrough:null};
}
export function buildCountingCuration(base,live){
  const effective=new Map(base.map(q=>[q.bookmarkId,q]));for(const r of live.overrides||[])if(r.unit==='L6'){const id=r.question.bookmarkId||r.question.id;if(r.deleted)effective.delete(id);else effective.set(id,r.question);}
  for(const r of live.questions||[])if(r.unit==='L6')effective.set(r.question.bookmarkId||r.question.id,r.question);
  const ids=[...effective].filter(([,q])=>q.category==='計數排序').map(([id])=>id),questions={};
  for(const id of ids){const versions=[];for(const q of [base.find(q=>q.bookmarkId===id),effective.get(id)].filter(Boolean)){
    let result;
    try { result=checkpoints[id]!==undefined?computation(q):theory(q); }
    catch(error) {
      // A retired built-in answer may already have been corrected publicly.
      // Never manufacture a derivation for that obsolete answer; use the
      // current override, whose calculation must still pass validation.
      if(q!==effective.get(id)&&error.message.includes('teacher answer'))continue;
      throw error;
    }
    const record={identity:identity(q),sourceExplanation:q.ex??q.explanation??'',explanation:result.explanation,walkthrough:result.walkthrough};
    if(!versions.some(v=>v.identity===record.identity&&v.sourceExplanation===record.sourceExplanation))versions.push(record);
  }questions[id]={versions};}
  return {schema:1,course:'algorithms',unit:'L6',updatedAt:'2026-11-01',questions};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {document}=parseHTML(await readFile('algorithms.html','utf8')),base=JSON.parse(document.getElementById('course-data').textContent).find(u=>u.id==='L6').questions;
  const live=JSON.parse(await readFile('content/algorithms-public-20261101.json','utf8')),curation=buildCountingCuration(base,live);
  await writeFile('assets/algorithms-counting-curation.json',JSON.stringify(curation,null,2)+'\n');
  await writeFile('content/L6_COUNTING_SORT_逐步解析_20261101.md','# L6 COUNTING_SORT：逐步解析\n\n原題、答案與選項保留。9 題陣列計算均以完整回填模擬核對答案。\n\n'+Object.entries(curation.questions).map(([id,m])=>{const v=m.versions.at(-1);return `## ${id}\n\n${JSON.parse(v.identity)[1]}\n\n${v.explanation}\n`;}).join('\n')+'\n規則參考：MIT 6.006 Recitation 7（2011），https://courses.csail.mit.edu/6.006/fall11/rec/rec07.pdf\n');
  console.log(`Prepared ${Object.keys(curation.questions).length} counting-sort explanations, including ${Object.values(curation.questions).filter(m=>m.versions.some(v=>v.walkthrough)).length} array walkthroughs.`);
}
