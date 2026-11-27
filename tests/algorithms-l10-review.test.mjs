import test from 'node:test';import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';import{DatabaseSync}from'node:sqlite';
import{matrixChain,assemblyLine,longestCommonSubsequence,knapsack01}from'../scripts/lib/dynamic-programming-worked.mjs';
import{buildL10Review}from'../scripts/review-algorithms-l10-20261127.mjs';
import{prepareL10Updates,reviewedQuestion}from'../scripts/prepare-algorithms-l10-update-20261127.mjs';
import{loadCourse,orderingIssues}from'../scripts/audit-topic-order-20261102.mjs';
const before=JSON.parse(await readFile(new URL('../content/algorithms-l10-before-20261127.json',import.meta.url),'utf8'));
const review=JSON.parse(await readFile(new URL('../content/algorithms-l10-review-20261127.json',import.meta.url),'utf8'));
function enumerateMatrices(p,start=0,end=p.length-2){
 if(start===end)return [{cost:0,expression:String.fromCharCode(65+start)}];
 const result=[];for(let k=start;k<end;k++)for(const left of enumerateMatrices(p,start,k))for(const right of enumerateMatrices(p,k+1,end))result.push({cost:left.cost+right.cost+p[start]*p[k+1]*p[end+1],expression:'('+left.expression+right.expression+')'});return result;
}
const isSubsequence=(sub,whole)=>{let i=0;for(const letter of whole)if(sub[i]===letter)i++;return i===sub.length;};
const subsequences=s=>Array.from({length:2**s.length},(_,bits)=>[...s].filter((_,i)=>bits&(1<<i)).join(''));
test('L10 matrix costs and all optimal parenthesizations agree with exhaustive enumeration',()=>{
 for(const p of [[3,3,2,2,3,4],[3,2,2,3,4],[2,4,3,2,5]]){
  const result=matrixChain(p),all=enumerateMatrices(p),minimum=Math.min(...all.map(x=>x.cost));
  assert.equal(result.minimum,minimum);assert.deepEqual(new Set(result.expressions),new Set(all.filter(x=>x.cost===minimum).map(x=>x.expression)));
  for(let i=0;i<p.length-1;i++)for(let j=i;j<p.length-1;j++)assert.equal(result.cost[i][j],Math.min(...enumerateMatrices(p,i,j).map(x=>x.cost)));
 }
 assert.equal(matrixChain([3,3,2,2,3,4]).minimum,78);assert.equal(matrixChain([3,2,2,3,4]).minimum,60);assert.equal(matrixChain([2,4,3,2,5]).minimum,56);
});
test('every assembly table entry and final route agrees with all possible line choices',()=>{
 const inputs=[
  {entry:[2,4],exit:[3,2],processing:[[7,9,3,4,8,4],[8,5,6,4,5,7]],transfer:[[null,2,3,1,3,4],[null,2,1,2,2,1]]},
  {entry:[3,2],exit:[2,4],processing:[[5,8,4,7],[7,3,9,4]],transfer:[[null,4,2,3],[null,2,5,1]]},
  {entry:[2,3],exit:[4,2],processing:[[6,3,8,2],[4,7,2,6]],transfer:[[null,2,4,3],[null,3,1,5]]},
  {entry:[2,3],exit:[3,2],processing:[[4,2,6,3],[2,7,1,5]],transfer:[[null,3,1,4],[null,2,5,2]]},
 ];
 const cost=(input,route)=>input.entry[route[0]]+route.reduce((sum,line,j)=>sum+input.processing[line][j]+(j&&line!==route[j-1]?input.transfer[route[j-1]][j]:0),0);
 for(const input of inputs){const result=assemblyLine(input),n=input.processing[0].length;
  for(let length=1;length<=n;length++)for(let line=0;line<2;line++){
   const candidates=Array.from({length:2**length},(_,bits)=>Array.from({length},(_,j)=>(bits>>j)&1)).filter(route=>route.at(-1)===line);
   assert.equal(result.values[line][length-1],Math.min(...candidates.map(route=>cost(input,route))));
  }
  const routes=Array.from({length:2**n},(_,bits)=>Array.from({length:n},(_,j)=>(bits>>j)&1));
  assert.equal(result.minimum,Math.min(...routes.map(route=>cost(input,route)+input.exit[route.at(-1)])));
  for(const route of result.routes){const zero=route.map(line=>line-1);assert.equal(cost(input,zero)+input.exit[zero.at(-1)],result.minimum);}
 }
 assert.deepEqual(inputs.map(input=>assemblyLine(input).minimum),[38,29,24,17]);
});
test('LCS values agree with exhaustive prefix subsequences, including arrow ties and the invalid recorded string',()=>{
 for(const [x,y]of[['ABCBDAB','BDCABA'],['ABAZDC','BACZDBA']]){
  const result=longestCommonSubsequence(x,y);
  for(let i=0;i<=x.length;i++)for(let j=0;j<=y.length;j++)assert.equal(result.table[i][j],Math.max(...subsequences(x.slice(0,i)).filter(sub=>isSubsequence(sub,y.slice(0,j))).map(sub=>sub.length)));
  assert(isSubsequence(result.sequence,x)&&isSubsequence(result.sequence,y));assert.equal(result.sequence.length,result.length);
 }
 const r=longestCommonSubsequence('ABCBDAB','BDCABA');assert.equal(r.sequence,'BCBA');
 assert.deepEqual([[3,4],[4,6],[7,6],[3,3],[4,4],[6,6]].map(([i,j])=>[r.table[i][j],r.arrows[i][j]]),[[2,'L'],[3,'L'],[4,'U'],[2,'LU'],[2,'U'],[4,'LU']]);
 assert(!isSubsequence('ABZD','BACZDBA'));assert.equal(longestCommonSubsequence('ABAZDC','BACZDBA').sequence,'BAZD');
});
test('0/1 knapsack table agrees with all subsets and reconstructs fruit IDs 123',()=>{
 const items=[{weight:4,value:4500},{weight:5,value:5700},{weight:2,value:2250},{weight:1,value:1100},{weight:6,value:6700}],r=knapsack01(items,8);
 for(let i=0;i<=items.length;i++)for(let w=0;w<=8;w++){
  const values=Array.from({length:2**i},(_,bits)=>items.slice(0,i).filter((_,j)=>bits&(1<<j))).filter(set=>set.reduce((sum,item)=>sum+item.weight,0)<=w).map(set=>set.reduce((sum,item)=>sum+item.value,0));
  assert.equal(r.table[i][w],Math.max(...values));
 }
 assert.equal(r.maximum,9050);assert.deepEqual(r.selected,[1,2,3]);
});
const liveRows=()=>before.questions.map(row=>({id:row.id,course:'algorithms',unit:'L10',revision:row.revision,data:JSON.stringify(row.question),is_published:1}));
function database(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE public_questions(id TEXT PRIMARY KEY,course TEXT,unit TEXT,revision INTEGER,data TEXT,is_published INTEGER,updated_at INTEGER);CREATE TABLE question_history(id TEXT PRIMARY KEY,question_id TEXT,revision INTEGER,course TEXT,unit TEXT,data TEXT,is_published INTEGER,action TEXT,actor TEXT,note TEXT,created_at INTEGER)');const insert=db.prepare('INSERT INTO public_questions VALUES (?,?,?,?,?,?,NULL)');for(const r of liveRows())insert.run(r.id,r.course,r.unit,r.revision,r.data,r.is_published);return db;}
test('all 54 explanations cover option contents, retain source fields and explicitly document four concrete discrepancies',()=>{
 assert.deepEqual(buildL10Review(),review);assert.equal(review.questions.length,54);assert.equal(new Set(review.questions.map(q=>q.id)).size,54);
 assert.deepEqual(review.questions.filter(q=>q.issue).map(q=>q.issue),['assembly-exit-and-route','matrix-fixed-split-cost','lcs-comparison-formula','lcs-sequence-not-subsequence']);
 for(const source of before.questions){const record=review.questions.find(q=>q.id===source.id),next=reviewedQuestion(source.question,record);
  assert(record.explanation.length>=120,source.id);assert.doesNotMatch(record.explanation,/老師答案|依老師|老師指定|老師題庫|選項\s*[A-H](?![A-Za-z])/);
  for(const option of source.question.options??source.question.opts??[])assert(record.explanation.includes('「'+option+'」'),source.id+' '+option);
  const protectedFields=q=>Object.fromEntries(Object.entries(q).filter(([key])=>!['category','ex','explanation'].includes(key)));
  assert.deepEqual(protectedFields(next),protectedFields(source.question),source.id);
 }
});
test('guarded SQL preserves all old versions, changes only the reviewed fields and is idempotent',()=>{
 const db=database();try{
  const plan=prepareL10Updates(liveRows(),{now:1795760000000});assert.equal(plan.updates.length,54);
  for(const update of plan.updates){assert(Buffer.byteLength(update.sql)<100000);db.exec(update.sql);const row=db.prepare('SELECT * FROM public_questions WHERE id=?').get(update.id);assert.equal(row.revision,2);assert.equal(row.data,update.data);assert.equal(db.prepare('SELECT data FROM question_history WHERE id=?').get(update.historyId).data,update.previousData);}
  assert.equal(db.prepare('SELECT COUNT(*) n FROM question_history').get().n,54);
  const changes=db.prepare('SELECT total_changes() n').get().n;for(const update of plan.updates)db.exec(update.sql);assert.equal(db.prepare('SELECT total_changes() n').get().n,changes);
  assert.equal(prepareL10Updates(db.prepare('SELECT * FROM public_questions').all()).updates.length,0);
 }finally{db.close();}
});
test('a newer edit, publication change or unexpected new question cannot be overwritten by the prepared update',()=>{
 const db=database();try{
  const plan=prepareL10Updates(liveRows()),first=plan.updates[0],edited=JSON.parse(first.previousData);edited.ex='另一位編輯的新解析';
  db.prepare('UPDATE public_questions SET data=?,revision=2 WHERE id=?').run(JSON.stringify(edited),first.id);db.exec(first.sql);
  assert.equal(db.prepare('SELECT data FROM public_questions WHERE id=?').get(first.id).data,JSON.stringify(edited));assert.equal(db.prepare('SELECT COUNT(*) n FROM question_history').get().n,0);
  assert.throws(()=>prepareL10Updates(db.prepare('SELECT * FROM public_questions').all()),/新版本/);
  assert.throws(()=>prepareL10Updates([...liveRows(),{...liveRows()[0],id:'another-question'}]),/清單已改變/);
 }finally{db.close();}
});
test('reader, practice and public snapshot expose every L10 explanation and group topic then single/multiple/fill',async()=>{
 const {window,config,document}=await loadCourse('algorithms'),entries=config.examEntries(['L10']);assert.equal(entries.length,54);
 assert.deepEqual(orderingIssues(entries,window.courseTopicOrder,'algorithms'),[]);
 const topics=[];for(const entry of entries){const label=window.courseTopicOrder.topic(entry.q,'algorithms','L10').label;if(topics.at(-1)!==label)topics.push(label);const record=review.questions.find(q=>q.id===entry.id),source=before.questions.find(q=>q.id===entry.id).question;
  assert.equal(window.courseQuestionTools.explanationText(entry.q),record.explanation);assert.equal(entry.q.a??entry.q.answer,source.a??source.answer);assert.equal(entry.q.q??entry.q.stem,source.q??source.stem);
  const practice=window.courseQuestionTools.createOptionSession(()=>0.1).get(entry.q,entry.id);assert.equal(practice.ex??practice.explanation,record.explanation);
 }
 assert.deepEqual(topics,['動態規劃基礎','裝配線排程','矩陣鏈乘法','最長共同子序列','0/1 背包問題']);
 assert.deepEqual(JSON.parse(document.getElementById('course-community-snapshot').textContent),JSON.parse(await readFile(new URL('../assets/course-snapshots/algorithms.json',import.meta.url),'utf8')));
});
