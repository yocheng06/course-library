import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {verifyDatabaseBackup} from './verify-d1-backup.mjs';
export const supplements={
 'community-d2c1f4b3-8d56-47e6-8797-6a55631c4c5e-1':{category:'最長共同子序列',explanation:`先分清兩個階段：LCS_LENGTH 建立整張長度／箭頭表；PRINT_LCS 只沿已保存的箭頭回溯，輸出一條共同子序列，兩者的工作量不同。

解題過程：
1. 當 i=0 或 j=0，至少有一個前綴是空字串，沒有字元可輸出，立即返回。
2. 遇到左上箭頭，表示 X 的第 i 個字元與 Y 的第 j 個字元相同。先呼叫 PRINT_LCS(b,X,i−1,j−1)，把前面的共同字元輸出，再執行 print xi，順序才是由左到右。
3. 遇到向上箭頭，表示略過 X 的最後一個字元，呼叫 PRINT_LCS(b,X,i−1,j)。遇到向左箭頭則呼叫 PRINT_LCS(b,X,i,j−1)。
4. 每次至少減少 i 或 j；由 (m,n) 走到邊界至多經過 m+n 次，因此回溯時間為 O(m+n)，不是逐格重新填表。

逐項核對：
「B 處 PRINT_LCS(b, X, i-1, j)」：向上時減少 i、保留 j，與箭頭代表的前綴一致。
「時間複雜度 O(m+n)」：這是沿單一路徑回溯的標準上界，包含沿路輸出字元的成本。
「時間複雜度 O(mn)」：通常是兩層迴圈建立完整 LCS 表的成本。嚴格以大 O 的數學定義而言，它也能當回溯的較鬆上界，但不能據此說 PRINT_LCS 需要掃過整張表；本題比較的是標準回溯成本。
「C 處 PRINT_LCS(b, X, i+1, j)」：此處已回溯完左上前綴，接著應輸出 xi。增加 i 不會輸出目前字元，還可能超出表格或無法朝終止條件前進。

收錄答案包含增加 i 的敘述，與題幹虛擬碼的位置不一致。原答案維持不變；理解時應記住「先回溯左上，再輸出相同字元」，不能把錯誤遞迴當成輸出動作。`},
 'community-d2c1f4b3-8d56-47e6-8797-6a55631c4c5e-2':{category:'裝配線排程',explanation:`這題問的是「從一條裝配線移到另一條線」額外花的時間，因此選「轉換成本」。在時間最小化的裝配線模型裡，它也叫換線時間或 transfer time，通常記為 t。

例如到下一站有兩種走法：留在原線，花「前站最短時間＋下一站加工時間」；從另一線過來，則花「另一線前站最短時間＋換線時間＋下一站加工時間」。動態規劃比較兩個總和，取較小值。假設前站為 10、換線為 3、下一站加工為 5，跨線到此站需 10+3+5=18；其中額外的 3 就是本題所問的成本。

「站點時間」與「組裝時間」描述在工作站內處理產品的時間，通常記為 a，沒有表示線路之間的移動。
「固定開銷」是較廣泛的成本名稱，可能包含初始化等費用；本題已明確指定移動到另一條線，應使用具體的「轉換成本」。
換線不一定比較快；只有把換線與加工時間一起加完後仍較小，才應選跨線。`},
 'community-1ca3ea75-24e6-406c-baab-2a7223fe1656-1':{category:'最長共同子序列',explanation:`本題使用 LCS：字元順序必須保留，但不必連續。題幹雖寫「子字串」，給定的 LCS 表與箭頭仍採「最長共同子序列」的遞迴式；真正的共同子字串是另一個問題。

令 c[i,j] 為 S1 前 i 個字元與 S2 前 j 個字元的 LCS 長度。第 0 列及第 0 欄皆為 0。尾字元相同時，c[i,j]=c[i−1,j−1]+1，箭頭 LU；不同時比較上方 c[i−1,j] 與左方 c[i,j−1]，取較大者。平手採向上 U。

由短前綴往右、往下填表：
欄字元：　空 B A C Z D B A
第 0 列：0 0 0 0 0 0 0 0
第 1 列 A：0 0 1 1 1 1 1 1
第 2 列 B：0 1 1 1 1 1 2 2
第 3 列 A：0 1 2 2 2 2 2 3
第 4 列 Z：0 1 2 2 3 3 3 3
第 5 列 D：0 1 2 2 3 4 4 4
第 6 列 C：0 1 2 3 3 4 4 4

逐格計算：
[3,4] 比較 A 與 Z，不同。上方 c[2,4]=1，左方 c[3,3]=2，取左方，填 2 與 L。
[4,6] 比較 Z 與 B，不同。上方 c[3,6]=2，左方 c[4,5]=3，取左方，填 3 與 L。
[6,3] 比較 C 與 C，相同。左上 c[5,2]=2，加 1 得 3，填 3 與 LU。

依題目由上到下、每格先數值再箭頭，填 2/L/3/L/3/LU。不同字元時不能直接把左上加 1；箭頭必須指向實際提供目前最佳長度的來源。`},
 'community-17ae29c9-8137-4dfa-a3df-b9f177bc0554-1':{category:'裝配線排程',explanation:`題目只問「到站點 4」，因此算完第 4 站的加工時間就停，不加離開裝配線的 x，也不繼續計算第 5、6 站。

令 f1[j]、f2[j] 分別表示完成線 1、線 2 的第 j 站所需最短時間。
留在線 1：f1[j−1]+a1[j]；由線 2 跨來：f2[j−1]+t2[j]+a1[j]。線 2 的式子對稱，跨來時使用 t1。

第 1 站：f1[1]=2+7=9；f2[1]=4+8=12。
第 2 站：f1[2]=min(9+9,12+2+9)=min(18,23)=18；f2[2]=min(12+5,9+2+5)=min(17,16)=16。
第 3 站：f1[3]=min(18+3,16+1+3)=min(21,20)=20；f2[3]=min(16+6,18+3+6)=min(22,27)=22。
第 4 站：f1[4]=min(20+4,22+2+4)=min(24,28)=24；f2[4]=min(22+4,20+1+4)=min(26,25)=25。

未指定第 4 站在哪條線，取 min(24,25)=24 分。

逐項核對：「24分」包含進入及前四站的最佳加工／換線成本，符合問題；「25分」是完成線 2 第 4 站的最短時間，但仍比線 1 多 1 分；「20分」只完成線 1 第 3 站；「22分」只完成線 2 第 3 站。後兩者都還沒做完第 4 站，不能當答案。`},
 'community-17ae29c9-8137-4dfa-a3df-b9f177bc0554-2':{category:'動態規劃基礎',explanation:`答案是 optimal substructure，意思是「最佳子結構」。它描述：把完整問題拆成適當子問題後，某個整體最佳解所使用的子問題解，也必須是那些子問題的最佳解。

為什麼需要它？假設整體最佳路線的前半段不是到同一狀態的最短路線，而且前後段只透過這個狀態銜接；就能把前半段換成更短的路線，讓整體也更短，與原本已最佳矛盾。因此可以只保存每個狀態的最佳值，再比較所有合法轉移。

以裝配線為例，狀態要包含「做到第幾站、在哪條線」。只記到第幾站、卻不記線路，會漏掉後續換線成本，不能保證保存的最短前綴能接出整體最佳解。先定義足夠完整的狀態，才談得上最佳子結構。

重疊子問題（overlapping subproblems）說的是同一狀態會被反覆需要，保存結果可避免重算；它與最佳子結構的「能否正確合成最佳解」不同。本題問最佳化型動態規劃的適用前提，填 optimal substructure。這也不表示任意局部貪婪選擇都會正確，仍要比較所有必要轉移。`},
 'community-21c6ff20-a210-4f58-b3e9-ec6229f8575a-1':{category:'裝配線排程',explanation:`先求每一站兩條線的最短完成時間，再加各自的離場時間，最後沿前驅回溯路線。到末站的完成時間與出廠總時間要分開。

第 1 站：f1[1]=2+4=6；f2[1]=3+2=5。
第 2 站：f1[2]=min(6+2,5+2+2)=min(8,9)=8，來自線 1；f2[2]=min(5+7,6+3+7)=min(12,16)=12，來自線 2。
第 3 站：f1[3]=min(8+6,12+5+6)=min(14,23)=14；f2[3]=min(12+1,8+1+1)=min(13,10)=10，來自線 1。
第 4 站：f1[4]=min(14+3,10+2+3)=min(17,15)=15，來自線 2；f2[4]=min(10+5,14+4+5)=min(15,23)=15，來自線 2。

加離場時間：線 1 為 15+3=18；線 2 為 15+2=17，所以最少出廠時間是 17。
回溯：線 2 第 4 站 ← 線 2 第 3 站 ← 線 1 第 2 站 ← 線 1 第 1 站。由前往後寫成 1,S11,S12,S23,S24，成本為 2+4+2+1+1+5+2=17；其中中間額外的 1 是線 1 第 2 站到線 2 第 3 站的換線時間。

收錄答案中的時間 17 與推算一致，但路線寫 2,S21,S12,S23,S24。依題幹數值，該路線成本是 3+2+2+2+1+1+5+2=18：先進線 2，必須在前往線 1 第 2 站時多算一次換線。這條路線不能同時得到 17。原答案保留，解析將起點與換線成本差異列清楚；不可只看路線後半段相同就忽略前段多出的成本。`}
};

const quote=value=>typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
export function prepareCompletion(rows,settings,{now=Date.now()}={}){
 const updates=[];
 for(const [id,record] of Object.entries(supplements)){
  const row=rows.find(r=>r.id===id);if(!row||row.course!=='algorithms'||row.unit!=='L10'||row.is_published!==1)throw Error('目標題目不存在或狀態已變更：'+id);
  const before=JSON.parse(row.data),after={...before,category:record.category};
  if(Object.hasOwn(before,'ex'))after.ex=record.explanation;
  if(Object.hasOwn(before,'explanation')||!Object.hasOwn(before,'ex'))after.explanation=record.explanation;
  if(JSON.stringify(before)===JSON.stringify(after))continue;
  if(String(before.explanation??before.ex??'').trim())throw Error('目標已新增解析，請先核對：'+id);
  const data=JSON.stringify(after),historyId=randomUUID();
  const where=`id=${quote(id)} AND course='algorithms' AND unit='L10' AND is_published=1 AND revision=${row.revision} AND data=${quote(row.data)}`;
  const sql=`INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at) SELECT ${quote(historyId)},id,revision,course,unit,data,is_published,'update','owner-requested-l10-completion','補齊 L10 解析與主題；保留題幹、選項及答案',${now} FROM public_questions WHERE ${where};\nUPDATE public_questions SET data=${quote(data)},revision=revision+1,updated_at=${now} WHERE ${where} AND EXISTS(SELECT 1 FROM question_history WHERE id=${quote(historyId)});`;
  updates.push({id,before,after,revision:row.revision,sql});
 }
 const units=JSON.parse(settings.data),unit=units.find(u=>u.id==='L10');if(!unit)throw Error('找不到 L10 單元設定');
 unit.title='動態規劃';unit.en='Dynamic Programming';
 const after=JSON.stringify(units),historyId=randomUUID();
 const guard=`course='algorithms' AND revision=${settings.revision} AND data=${quote(settings.data)}`;
 const unitSql=after===settings.data?'':`INSERT INTO unit_settings_history(id,course,revision,before_data,after_data,actor,created_at) SELECT ${quote(historyId)},course,revision+1,data,${quote(after)},'owner-requested-l10-completion',${now} FROM unit_settings WHERE ${guard};\nUPDATE unit_settings SET data=${quote(after)},revision=revision+1,updated_at=${now} WHERE ${guard} AND EXISTS(SELECT 1 FROM unit_settings_history WHERE id=${quote(historyId)});`;
 return {updates,unitSql,sql:[...updates.map(u=>u.sql),unitSql].filter(Boolean).join('\n'),units};
}
export async function stageCompletionSnapshot(publicData){
 const file='assets/course-snapshots/algorithms.json',snapshot=JSON.parse(await readFile(file,'utf8'));
 const current=publicData.questions.filter(row=>row.unit==='L10');
 if(current.length!==60)throw Error('L10 題數已變更，請重新核對範圍');
 const rows=current.map(row=>{const q=row.question,id=q.id??q.bookmarkId,record=supplements[id];if(!record)return row;const question={...q,category:record.category};if(Object.hasOwn(q,'ex'))question.ex=record.explanation;if(Object.hasOwn(q,'explanation')||!Object.hasOwn(q,'ex'))question.explanation=record.explanation;return {...row,question};});
 snapshot.data.questions=[...snapshot.data.questions.filter(row=>row.unit!=='L10'),...rows];
 snapshot.data.units=publicData.units.map(unit=>unit.id==='L10'?{...unit,title:'動態規劃',en:'Dynamic Programming',label:'L10 · 動態規劃'}:unit);
 snapshot.generatedAt=new Date().toISOString();delete snapshot.data.revision;
 snapshot.data.revision=createHash('sha256').update(JSON.stringify(snapshot.data)).digest('hex');
 const json=JSON.stringify(snapshot).replaceAll('<','\\u003c');await writeFile(file,json+'\n');
 const html=await readFile('algorithms.html','utf8');await writeFile('algorithms.html',html.replace(/(<script id="course-community-snapshot" type="application\/json">)[\s\S]*?(<\/script>)/,(_,open,close)=>open+json+close));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw Error('請指定正式備份 SQL');
 const sql=await readFile(file,'utf8'),report=verifyDatabaseBackup(sql),db=new DatabaseSync(':memory:');
 try{
  db.exec(sql);
  const rows=db.prepare("SELECT * FROM public_questions WHERE course='algorithms' AND unit='L10' AND is_published=1").all();
  const settings=db.prepare("SELECT * FROM unit_settings WHERE course='algorithms'").get(),plan=prepareCompletion(rows,settings);
  const outside=db.prepare("SELECT id,data,revision FROM public_questions WHERE NOT(course='algorithms' AND unit='L10') ORDER BY id").all();
  const previousHistories=db.prepare('SELECT count(*) n FROM question_history').get().n;
  db.exec(plan.sql);
  if(db.prepare('SELECT count(*) n FROM question_history').get().n!==previousHistories+plan.updates.length)throw Error('歷史新增數量不符');
  for(const change of plan.updates){const row=db.prepare('SELECT data FROM public_questions WHERE id=?').get(change.id);if(row.data!==JSON.stringify(change.after))throw Error('演練更新不符');}
  if(JSON.stringify(outside)!==JSON.stringify(db.prepare("SELECT id,data,revision FROM public_questions WHERE NOT(course='algorithms' AND unit='L10') ORDER BY id").all()))throw Error('影響其他單元');
  const changes=db.prepare('SELECT total_changes() n').get().n;db.exec(plan.sql);if(changes!==db.prepare('SELECT total_changes() n').get().n)throw Error('重複執行不安全');
  await writeFile('artifacts/l10-completion-update.sql',plan.sql+'\n');
  await writeFile('content/algorithms-l10-completion-20261127.json',JSON.stringify({course:'algorithms',unit:'L10',title:'動態規劃',en:'Dynamic Programming',questionCount:rows.length,questions:plan.updates.map(({id,before,after,revision})=>({id,revision,before,after}))},null,2)+'\n');
  if(process.argv.includes('--snapshot'))await stageCompletionSnapshot(JSON.parse(await readFile('artifacts/l10-current-public.json','utf8')));
  console.log(JSON.stringify({publicQuestions:rows.length,updated:plan.updates.length,fullBackupVerified:report.ok,imagesVerified:report.imagesVerified,simulationPassed:true,idempotent:true}));
 }finally{db.close();}
}
