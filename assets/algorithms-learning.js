/* Algorithm question-bank interactions. */
'use strict';
const COURSES=JSON.parse(document.getElementById('course-data').textContent);
function refreshCourseSummary(){
 const total=COURSES.reduce((sum,unit)=>sum+unit.questions.length,0);
 document.querySelector('[data-course-total]').textContent=`${COURSES.length} 個單元 · ${total} 道題目`;
 document.querySelector('meta[name="description"]').content=`整合演算法課程與${total}道題目，依章節閱讀與練習。可離線使用。`;
 document.querySelector('[data-course-source-summary]').textContent=`收錄 ${COURSES.length} 份題庫：${COURSES.map(course=>course.id+' '+course.questions.length+' 題').join('、')}，共 ${total} 題。L6 中僅選項順序不同的版本已合併；題幹或選項內容不同的版本分開保留。已提供題庫答案的題目視為正常；選擇題與有標準答案的填空題可自動核對，答錯可重試，答對後顯示解析。`;
}
refreshCourseSummary();
const $=id=>document.getElementById(id);
const meta={
 L2:{title:'基礎與漸進分析',short:'基礎與漸進分析',en:'ALGORITHM FUNDAMENTALS',sub:'漸進符號 · 函數增長率 · 插入排序與合併排序',guide:'把 n 想成待整理的書本數量：O 看成長速度的上界，Ω 看下界，Θ 表示同階。它們不是「最壞／最好情況」的別名。學排序時，先問採用什麼方法，再比較資料變多後需要多少步驟。'},
 L3:{title:'遞迴關係式與分治分析',short:'遞迴關係式',en:'RECURRENCE RELATIONS',sub:'代入法 · 遞迴樹 · 大師定理與適用條件',guide:'想像把一疊作業分給幾個人，再把結果合起來。T(n)=aT(n/b)+f(n) 中，a 是分出幾份、n/b 是每份大小、f(n) 是分配與整合的成本。遞迴樹逐層加總；大師定理則要先確認形式與條件。'},
 L4:{title:'堆積、堆積排序與優先佇列',short:'Heap 與 Heapsort',en:'HEAP & PRIORITY QUEUE',sub:'Heap 性質 · Max-Heapify · Heapsort · Priority Queue',guide:'把 Max-Heap 想成「優先處理最高分任務」的排列：父節點不小於子節點，最大值在根部，但整個陣列未必已排序。索引從 1 開始時，左子是 2i、右子是 2i+1、父節點是 floor(i/2)。'},
 L5:{title:'快速排序',short:'快速排序',en:'QUICK SORT',sub:'Pivot · Partition · 遞迴與複雜度',guide:'把陣列想成一列卡片：先選一張作為 pivot，再用 Partition 把較小與較大的值分到兩側，讓 pivot 到達正確位置，接著遞迴處理兩邊。分割大致平均時，時間通常是 Θ(n log n)；每次都極端不平衡時，可能退化到 Θ(n²)。'},
 L6:{title:'排序演算法',short:'排序演算法',en:'SORTING ALGORITHMS',sub:'Counting Sort · Bucket Sort · Radix Sort · 比較排序下界',guide:'計數排序利用有限範圍的鍵值統計次數；桶排序把資料分配到區間；基數排序逐位整理，並需要穩定的子排序。先確認輸入條件，再比較時間與空間成本；決策樹可說明比較排序的下界。'}
};
let lesson='L2',chapter='全部',type='全部',page=1,totalPages=1,mode='study';
const PAGE_SIZE=10, drafts=new Map(), revealed=new Set(), selections=new Map(), feedback=new Map();
const practiceSequence=window.courseQuestionTools.createPracticeOrder();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>COURSES.find(c=>c.id===lesson);
const kind=window.courseQuestionTools.questionType;
const questionId=(course,i)=>course.questions[i].bookmarkId||course.id+'-'+String(i+1).padStart(3,'0');const idFor=i=>questionId(current(),i);
const isMissing=window.courseQuestionTools.missingSource;
const questionEntries=COURSES.flatMap(unit=>unit.questions.map((q,i)=>({q,i,id:questionId(unit,i),unit})));
const allUnits=()=>$('searchScopeSelect').value==='all';
const scopedEntries=()=>allUnits()?questionEntries:questionEntries.filter(entry=>entry.unit.id===lesson);
const communityAliases=new Map();
const findEntry=id=>questionEntries.find(entry=>entry.id===(communityAliases.get(id)||id)||entry.q.aliases?.includes(id));
function refreshFilters(){const entries=scopedEntries();window.courseQuestionTools.populateSelect($('chapterSelect'),entries.map(({q})=>q.category),'全部','全部章節');window.courseQuestionTools.populateSelect($('typeSelect'),entries.map(({q})=>kind(q)),'全部','全部題型');chapter=$('chapterSelect').value;type=$('typeSelect').value;}
function searchTerms(){return $('search').value.trim().split(/\s+/).filter(Boolean);}
function highlighted(value){const text=String(value??''),terms=[...new Set(searchTerms())];if(!terms.length)return esc(text);const re=new RegExp(terms.sort((a,b)=>b.length-a.length).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gi');let result='',last=0;for(const match of text.matchAll(re)){result+=esc(text.slice(last,match.index))+'<mark>'+esc(match[0])+'</mark>';last=match.index+match[0].length;}return result+esc(text.slice(last));}
function selectedItems(){return scopedEntries().filter(({q,id})=>(!window.learningUI?.reviewOnly||window.learningUI.isSaved(id))&&(mode!=='practice'||window.coursePracticeProgress?.includes(id)!==false)&&(chapter==='全部'||q.category===chapter)&&(type==='全部'||kind(q)===type)&&($('qualitySelect').value!=='pending'||window.courseQuestionTools.qualityReasons(q,'algorithms').length>0)&&window.courseQuestionTools.matchesSearch(q, $('search').value));}
function unitNumber(id){return id.replace(/^L/,'').padStart(2,'0')}
function setupLesson(preserveCards=false){document.querySelectorAll('.community-course-link').forEach(link=>{link.href=`submit.html?course=algorithms&unit=${encodeURIComponent(lesson)}`;});const c=current(),m=meta[lesson];$('lessonPicker').innerHTML=COURSES.map(item=>`<option value="${item.id}">UNIT ${unitNumber(item.id)} · ${meta[item.id].short} · ${item.questions.length} 題</option>`).join('');$('lessonPicker').value=lesson;$('crumb').textContent='UNIT '+unitNumber(lesson)+' / '+m.short;$('eyebrow').textContent=m.en;$('lessonTitle').textContent=m.title;$('lessonSub').textContent=m.sub;$('lessonCount').textContent=c.questions.length;$('guideText').textContent=m.guide;$('sourceLabel').textContent='目前來源：'+c.source;refreshFilters();
 $('courseMenu').innerHTML=COURSES.map(item=>`<button class="course-nav ${item.id===lesson?'active':''}" data-lesson="${item.id}" aria-pressed="${item.id===lesson}"><span class="course-copy"><span class="unit-number">UNIT ${unitNumber(item.id)}</span><span class="unit-row"><strong>${meta[item.id].short}</strong><span class="unit-count">${item.questions.length} 題</span></span><small class="unit-en">${meta[item.id].en}</small></span></button>`).join('');
 $('lessonTabs').innerHTML=COURSES.map(item=>`<button class="lesson-tab ${item.id===lesson?'active':''}" data-lesson="${item.id}" aria-pressed="${item.id===lesson}"><span class="tabtop"><span>${item.id}</span><small>${item.questions.length} 題</small></span><strong>${meta[item.id].short}</strong></button>`).join('');
 render(preserveCards);}
function renderChapters(){$('chapterSelect').value=chapter;}
function answerMarkup(q,id){return `<div class="answer" id="answer-${id}"><div><strong>${window.courseQuestionTools.answerLabel(q)}</strong><br><span class="answer-value">${window.courseQuestionTools.answerValueMarkup(q,highlighted)}</span></div><div class="explain"><strong>解析</strong><div class="explanation-text">${window.courseQuestionTools.explanationMarkup(q, highlighted)}</div></div>${q.note?`<div class="warning"><strong>觀念提醒：</strong>${highlighted(q.note)}</div>`:q.warn?'<div class="warning">原資料已標記此題需要核對；請搭配原題、完整選項或老師的說明確認。</div>':''}${window.courseQuestionTools.reviewMarkup(q)}</div>`;}
function questionImagesMarkup(q){return window.courseQuestionTools.questionImagesMarkup(q);}
function expectedOptionKeys(q,options){if(!window.courseQuestionTools.hasProvidedAnswer(q))return new Set();const expected=q.choiceKey||window.coursePractice?.expectedChoiceKey(q.a,options);return new Set(String(expected||''));}
function optionContent(value){const text=String(value??''),match=text.match(/^([A-H][.、．:：])(\s*)([\s\S]*)$/);return match?`<span class="option-label">${highlighted(match[1])}</span>${esc(match[2])}${highlighted(match[3])}`:highlighted(text);}
function cardMarkup({q,id,i,unit}){
 const isPractice=mode==='practice',open=isPractice?revealed.has(id):$('showAnswers').checked||revealed.has(id),opts=q.opts||[],chosen=selections.get(id)||[],f=feedback.get(id),correctKeys=!isPractice&&open?expectedOptionKeys(q,opts):new Set();
 let options='';
 if(opts.length)options=`<div class="options">${opts.map((o,k)=>{
  const mark=window.coursePractice.optionMark(f,k);
  return isPractice?`<label class="option ${chosen.includes(k)?'chosen':''} ${mark.className}"><input type="${window.courseQuestionTools.answerType(q)==='多選題'?'checkbox':'radio'}" name="choice-${id}" data-choice="${id}" data-index="${k}" ${chosen.includes(k)?'checked':''} ${mark.className==='practice-incorrect'?'aria-invalid="true"':''}><span>${optionContent(o)}</span>${mark.icon}</label>`:`<div class="option ${correctKeys.has(String.fromCharCode(65+k))?'correct':''}">${optionContent(o)}</div>`;
 }).join('')}</div>`;
 const pending=window.courseQuestionTools.qualityReasons(q,'algorithms').length>0,textMark=window.coursePractice.textMark(f);
 const entry=isPractice&&!opts.length?window.coursePractice.entryMarkup(q,id,drafts.get(id),textMark):'';
 const hasResponse=chosen.length>0||Boolean(drafts.get(id)?.trim());
 const buttonText=isPractice?'檢查答案':open?'收起答案':'查看答案與解析';
 return `<article class="card" data-id="${id}"><div class="cardtop"><div class="badges">${allUnits()?`<span class="badge unit-badge">UNIT ${unitNumber(unit.id)} · ${esc(meta[unit.id].short)}</span>`:''}<span class="badge">${highlighted(q.category)}</span><span class="badge neutral">${highlighted(kind(q))}</span>${window.courseQuestionTools.incompleteReasons(q).length?'<span class="badge gold">資料不完整</span>':''}${q.exact?'<span class="badge gold">注意答案格式</span>':''}${pending?'<span class="badge gold">待確認</span>':''}</div><span class="qid">#${String(i+1).padStart(3,'0')}</span></div><h3 class="question" tabindex="-1">${highlighted(q.q)}</h3>${window.courseQuestionTools.searchMatchMarkup(q,$('search').value)}${window.courseQuestionTools.qualityMarkup(q,'algorithms')}${window.courseQuestionTools.incompleteMarkup(q)}${isMissing(q)&&!q.missingContext?'<div class="warning" style="margin-bottom:12px">原資料未附完整題圖或對應虛擬碼，無法單憑此文字獨立重建題目。請搭配原始教材。</div>':''}${questionImagesMarkup(q)}${options}${entry}${isPractice?`<div class="practice-actions"><button class="reveal" data-reveal="${id}" aria-controls="answer-${id}">${buttonText}</button><button type="button" class="plain" data-clear-response="${id}" ${hasResponse?'':'disabled'}>清除作答</button><button type="button" class="plain" data-show-answer="${id}" aria-controls="answer-${id}" aria-expanded="${open}">${open?'收起答案與解析':'顯示答案與解析'}</button></div>`:!$('showAnswers').checked?`<button class="reveal" data-reveal="${id}" aria-controls="answer-${id}" aria-expanded="${open}">${buttonText}</button>`:''}${isPractice&&f?window.coursePractice.markup(f,id):''}<div ${open?'':'hidden'} data-answer="${id}">${answerMarkup(q,id)}</div></article>`;
}
function render(preserveCards=false){renderChapters();$('typeSelect').value=type;const filtered=selectedItems(),items=practiceSequence.apply(filtered,mode==='practice'&&$('practiceOrder').value==='random',entry=>entry.id),entries=scopedEntries(),pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));page=Math.min(page,pages);totalPages=pages;const start=(page-1)*PAGE_SIZE;$('qualitySelect').options[1].textContent=`待確認（${entries.filter(({q})=>window.courseQuestionTools.qualityReasons(q,'algorithms').length).length} 題）`;$('resultSummary').innerHTML=`<strong>${allUnits()?'全部單元':'目前單元'} · ${esc(chapter==='全部'?'全部章節':chapter)}</strong> · ${items.length} / ${entries.length} 題`;$('rangeSummary').textContent=items.length?`${start+1}–${Math.min(start+PAGE_SIZE,items.length)} · 第 ${page} / ${pages} 頁`:'0 題';const visible=items.slice(start,start+PAGE_SIZE),cards=[...$('list').children];if(!preserveCards||visible.length!==cards.length||visible.some((entry,i)=>entry.id!==cards[i].dataset.id))$('list').innerHTML=visible.map(cardMarkup).join('');$('empty').hidden=items.length!==0;$('pager').innerHTML=pages>1?`<button data-page="${page-1}" aria-label="上一頁" ${page===1?'disabled':''}>←</button>`+Array.from({length:pages},(_,i)=>`<button data-page="${i+1}" ${page===i+1?'class="active" aria-current="page"':''} aria-label="第 ${i+1} 頁">${i+1}</button>`).join('')+`<button data-page="${page+1}" aria-label="下一頁" ${page===pages?'disabled':''}>→</button>`:'';$('studyMode').classList.toggle('active',mode==='study');$('practiceMode').classList.toggle('active',mode==='practice');$('studyMode').setAttribute('aria-pressed',mode==='study');$('practiceMode').setAttribute('aria-pressed',mode==='practice');$('answerToggle').hidden=mode==='practice';$('modeHint').hidden=mode!=='practice';$('practiceOrderControl').hidden=mode!=='practice';window.learningUI?.refresh();}
function changeLesson(next){if(next===lesson)return;lesson=next;page=1;if(!allUnits())$('search').value='';revealed.clear();setupLesson();}
function resetFilters(){window.learningUI?.clearReview();window.coursePracticeProgress?.clearFilter();chapter='全部';type='全部';page=1;$('search').value='';$('qualitySelect').value='all';render();}
function switchMode(next){mode=next;revealed.clear();feedback.clear();render();}
function toggleAnswer(id,button) {
 const card=button.closest('.card'),panel=card.querySelector('[data-answer]');
 if(mode==='practice'){
  const wasRevealed=revealed.has(id),q=findEntry(id).q,response=card.querySelector('[data-draft]')?.value||'';
  const result=window.coursePractice.evaluate(q.a,q.opts||[],selections.get(id)||[],q,response);feedback.set(id,result);window.coursePracticeProgress?.record(id,result,{choices:selections.get(id)||[],text:response});
  const shouldOpen=result.correct===true||result.revealAnswer||wasRevealed;panel.hidden=!shouldOpen;
  if(shouldOpen)revealed.add(id);else revealed.delete(id);
  button.textContent='檢查答案';const answerButton=card.querySelector('[data-show-answer]');if(answerButton){answerButton.setAttribute('aria-expanded',String(shouldOpen));answerButton.textContent=shouldOpen?'收起答案與解析':'顯示答案與解析';}
  window.coursePractice.show(card,result,id);return;
 }
 const open=panel.hidden;panel.hidden=!open;
 const q=findEntry(id).q,correctKeys=open?expectedOptionKeys(q,q.opts||[]):new Set();
 card.querySelectorAll('.option').forEach((option,index)=>option.classList.toggle('correct',correctKeys.has(String.fromCharCode(65+index))));
 if(open)revealed.add(id);else revealed.delete(id);button.setAttribute('aria-expanded',String(open));button.textContent=open?'收起答案':'查看答案與解析';
}
function togglePracticeAnswer(id,button){const card=button.closest('.card'),panel=card.querySelector('[data-answer]'),open=panel.hidden;panel.hidden=!open;if(open)revealed.add(id);else revealed.delete(id);button.setAttribute('aria-expanded',String(open));button.textContent=open?'收起答案與解析':'顯示答案與解析';}
function clearResponse(id,button){const card=button.closest('.card');card.querySelectorAll('[data-choice]').forEach(input=>{input.checked=false;});card.querySelectorAll('.option').forEach(option=>option.classList.remove('chosen'));const draft=card.querySelector('[data-draft]');if(draft)draft.value='';card.querySelectorAll('[data-fill-index]').forEach(field=>{field.value='';});selections.delete(id);drafts.delete(id);feedback.delete(id);revealed.delete(id);card.querySelector('[data-answer]').hidden=true;card.querySelector('.practice-feedback')?.remove();window.coursePractice.clearMarks(card);const check=card.querySelector('[data-reveal]');check.textContent='檢查答案';check.setAttribute('aria-expanded','false');const answerButton=card.querySelector('[data-show-answer]');answerButton.textContent='顯示答案與解析';answerButton.setAttribute('aria-expanded','false');button.disabled=true;(card.querySelector('[data-fill-index]')||draft||card.querySelector('[data-choice]'))?.focus();}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.lesson)changeLesson(b.dataset.lesson);else if(b.dataset.chapter){chapter=b.dataset.chapter;page=1;render();}else if(b.dataset.page){page=Number(b.dataset.page);render();window.courseQuestionTools.focusResults();}else if(b.dataset.clearResponse!==undefined)clearResponse(b.dataset.clearResponse,b);else if(b.dataset.showAnswer!==undefined)togglePracticeAnswer(b.dataset.showAnswer,b);else if(b.dataset.reveal)toggleAnswer(b.dataset.reveal,b);});
$('search').addEventListener('input',()=>{page=1;render();});$('chapterSelect').addEventListener('change',e=>{chapter=e.target.value;page=1;render();});$('typeSelect').addEventListener('change',e=>{type=e.target.value;page=1;render();});$('showAnswers').addEventListener('change',()=>{revealed.clear();render();});$('clearBtn').onclick=resetFilters;$('emptyReset').onclick=resetFilters;$('studyMode').onclick=()=>switchMode('study');$('practiceMode').onclick=()=>switchMode('practice');$('practiceOrder').addEventListener('change',()=>{practiceSequence.reset();page=1;render();});
$('qualitySelect').addEventListener('change',()=>{page=1;render();});
$('searchScopeSelect').addEventListener('change',()=>{page=1;refreshFilters();render();});
$('list').addEventListener('input',e=>{
 if(!e.target.dataset.draft)return;const id=e.target.dataset.draft;drafts.set(id,e.target.value);
 const card=e.target.closest('.card'),button=card.querySelector('[data-reveal]'),clear=card.querySelector('[data-clear-response]');if(clear)clear.disabled=!e.target.value.trim();
 if(!feedback.has(id)&&!revealed.has(id))return;
 feedback.delete(id);revealed.delete(id);
 card.querySelector('[data-answer]').hidden=true;card.querySelector('.practice-feedback')?.remove();window.coursePractice.clearMarks(card);
 button.textContent='檢查答案';button.setAttribute('aria-expanded','false');
 const answerButton=card.querySelector('[data-show-answer]');if(answerButton){answerButton.textContent='顯示答案與解析';answerButton.setAttribute('aria-expanded','false');}
});
$('list').addEventListener('change',e=>{const input=e.target,id=input.dataset.choice;if(!id)return;const k=Number(input.dataset.index);let chosen=selections.get(id)||[];chosen=input.type==='radio'?[k]:input.checked?[...new Set([...chosen,k])]:chosen.filter(i=>i!==k);selections.set(id,chosen);const card=input.closest('.card');card.querySelectorAll('.option').forEach(label=>label.classList.toggle('chosen',label.querySelector('input').checked));const clear=card.querySelector('[data-clear-response]');if(clear)clear.disabled=chosen.length===0;revealed.delete(id);feedback.delete(id);card.querySelector('[data-answer]').hidden=true;card.querySelector('.practice-feedback')?.remove();window.coursePractice.clearMarks(card);const b=card.querySelector('[data-reveal]');b.textContent='檢查答案';b.setAttribute('aria-expanded','false');const answerButton=card.querySelector('[data-show-answer]');if(answerButton){answerButton.textContent='顯示答案與解析';answerButton.setAttribute('aria-expanded','false');}});
$('lessonPicker').addEventListener('change',e=>changeLesson(e.target.value));
const linkedQuestion=new URLSearchParams(location.search).get('question');
const linkedEntry=findEntry(linkedQuestion);
if(linkedEntry)lesson=linkedEntry.unit.id;
setupLesson();
if(linkedEntry){page=Math.floor(linkedEntry.i/PAGE_SIZE)+1;render();window.courseQuestionTools.focusLinkedQuestion(linkedEntry.id);}
let waitingForLinkedQuestion=!linkedEntry && /^community-/.test(linkedQuestion||'');
function mergeCommunityQuestions(entries,{openLinkedQuestion=false,aliases=[]}={}){
 for(const alias of Array.isArray(aliases)?aliases:[])if(/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(alias?.id)&&questionEntries.some(e=>e.id===alias.target))communityAliases.set(alias.id,alias.target);
 let added=0;
 for(const entry of entries){
  if(!entry||typeof entry!=='object')continue;
  const {unit:unitId,question:q}=entry;
  const unit=COURSES.find(unit=>unit.id===unitId);
  if(!unit||!q||!/^community-[0-9a-f-]{36}-[1-9]\d*$/.test(q.bookmarkId)||typeof q.q!=='string'||typeof q.a!=='string'||findEntry(q.bookmarkId))continue;
  const i=unit.questions.length;unit.questions.push(q);questionEntries.push({q,i,id:q.bookmarkId,unit});added++;
 }
 window.learningUI?.refresh();
 if(!added&&!communityAliases.size)return {added:0,openedLinkedQuestion:false};
 refreshCourseSummary();
 const linked=waitingForLinkedQuestion&&openLinkedQuestion&&findEntry(linkedQuestion);
 if(linked){waitingForLinkedQuestion=false;lesson=linked.unit.id;setupLesson();page=Math.floor(linked.i/PAGE_SIZE)+1;render();window.courseQuestionTools.focusLinkedQuestion(linked.id);}
 else setupLesson(true);
 return {added,openedLinkedQuestion:Boolean(linked)};
}
window.courseLearning={
 examEntries:all=>questionEntries.filter(e=>all||e.unit.id===lesson).map(e=>({id:e.id,q:e.q,unit:meta[e.unit.id].short})),
 examUnitLabel:()=>meta[lesson].short,
 mergeCommunityQuestions,
 unitIds:()=>current().questions.map((q,i)=>idFor(i)),
 scopeIds:()=>scopedEntries().map(entry=>entry.id),allUnits,
 scopeLabel:()=>allUnits()?`演算法 · 全部 ${COURSES.length} 個單元`:`目前單元 · ${meta[lesson].short}`,
 course:'algorithms', toolbar:document.querySelector('.toolbar'), sidebar:document.querySelector('.sidebar'), list:$('list'),
 cardTop:card=>card.querySelector('.cardtop'), render, resetPage:()=>{page=1;},
 resolveId:id=>findEntry(id)?.id,
 validId:id=>Boolean(findEntry(id)),
 questionLabel:id=>{const entry=findEntry(id);return entry?meta[entry.unit.id].short+' 第 '+String(entry.i+1).padStart(3,'0')+' 題':'題目';},
 questionDetails:id=>{const {q,unit,i}=findEntry(id);return {course:'algorithms',id,unit:meta[unit.id].short,number:i+1,question:q.q,answer:q.a};},
 currentPage:()=>page,pageCount:()=>totalPages,practiceMode:()=>mode==='practice',
 resetPractice:()=>{drafts.clear();selections.clear();revealed.clear();feedback.clear();practiceSequence.reset();page=1;render();}
};
