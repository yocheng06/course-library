/* Algorithm question-bank interactions. */
'use strict';
const COURSES=JSON.parse(document.getElementById('course-data').textContent);
const courseTotal=COURSES.reduce((total,course)=>total+course.questions.length,0);
document.querySelector('[data-course-total]').textContent=`${COURSES.length} 個單元 · ${courseTotal} 道題目`;
document.querySelector('meta[name="description"]').content=`整合演算法課程與${courseTotal}道題目，依章節閱讀與練習。可離線使用。`;
document.querySelector('[data-course-source-summary]').textContent=`收錄 ${COURSES.length} 份題庫：${COURSES.map(course=>course.id+' '+course.questions.length+' 題').join('、')}，共 ${courseTotal} 題。已提供題庫答案的題目視為正常；選擇題依題庫答案核對，文字題請自行對照答案與解析。`;
const $=id=>document.getElementById(id);
const meta={
 L2:{title:'基礎與漸進分析',short:'基礎與漸進分析',en:'ALGORITHM FUNDAMENTALS',sub:'漸進符號 · 函數增長率 · 插入排序與合併排序',guide:'把 n 想成待整理的書本數量：O 看成長速度的上界，Ω 看下界，Θ 表示同階。它們不是「最壞／最好情況」的別名。學排序時，先問採用什麼方法，再比較資料變多後需要多少步驟。'},
 L3:{title:'遞迴關係式與分治分析',short:'遞迴關係式',en:'RECURRENCE RELATIONS',sub:'代入法 · 遞迴樹 · 大師定理與適用條件',guide:'想像把一疊作業分給幾個人，再把結果合起來。T(n)=aT(n/b)+f(n) 中，a 是分出幾份、n/b 是每份大小、f(n) 是分配與整合的成本。遞迴樹逐層加總；大師定理則要先確認形式與條件。'},
 L4:{title:'堆積、堆積排序與優先佇列',short:'Heap 與 Heapsort',en:'HEAP & PRIORITY QUEUE',sub:'Heap 性質 · Max-Heapify · Heapsort · Priority Queue',guide:'把 Max-Heap 想成「優先處理最高分任務」的排列：父節點不小於子節點，最大值在根部，但整個陣列未必已排序。索引從 1 開始時，左子是 2i、右子是 2i+1、父節點是 floor(i/2)。'}
};
let lesson='L2',chapter='全部',type='全部',page=1,totalPages=1,mode='study';
const PAGE_SIZE=10, drafts=new Map(), revealed=new Set(), selections=new Map(), feedback=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>COURSES.find(c=>c.id===lesson);
const kind=q=>!q.opts?.length&&/^(單選題|多選題|複選題)$/.test(q.type)?'文字作答':q.type==='複選題'?'多選題':q.type;
const questionId=(course,i)=>course.questions[i].bookmarkId||course.id+'-'+String(i+1).padStart(3,'0');const idFor=i=>questionId(current(),i);
const isMissing=window.courseQuestionTools.missingSource;
const questionEntries=COURSES.flatMap(unit=>unit.questions.map((q,i)=>({q,i,id:questionId(unit,i),unit})));
const allUnits=()=>$('searchScopeSelect').value==='all';
const scopedEntries=()=>allUnits()?questionEntries:questionEntries.filter(entry=>entry.unit.id===lesson);
const findEntry=id=>questionEntries.find(entry=>entry.id===id);
function refreshFilters(){const entries=scopedEntries();window.courseQuestionTools.populateSelect($('chapterSelect'),entries.map(({q})=>q.category),'全部','全部章節');window.courseQuestionTools.populateSelect($('typeSelect'),entries.map(({q})=>kind(q)),'全部','全部題型');chapter=$('chapterSelect').value;type=$('typeSelect').value;}
function searchTerms(){return $('search').value.trim().split(/\s+/).filter(Boolean);}
function highlighted(value){const text=String(value??''),terms=[...new Set(searchTerms())];if(!terms.length)return esc(text);const re=new RegExp(terms.sort((a,b)=>b.length-a.length).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gi');let result='',last=0;for(const match of text.matchAll(re)){result+=esc(text.slice(last,match.index))+'<mark>'+esc(match[0])+'</mark>';last=match.index+match[0].length;}return result+esc(text.slice(last));}
function selectedItems(){return scopedEntries().filter(({q,id})=>(!window.learningUI?.reviewOnly||window.learningUI.isSaved(id))&&(chapter==='全部'||q.category===chapter)&&(type==='全部'||kind(q)===type)&&($('qualitySelect').value!=='pending'||window.courseQuestionTools.qualityReasons(q,'algorithms').length>0)&&window.courseQuestionTools.matchesSearch(q, $('search').value));}
function unitNumber(id){return id.replace(/^L/,'').padStart(2,'0')}
function setupLesson(){const c=current(),m=meta[lesson];$('lessonPicker').innerHTML=COURSES.map(item=>`<option value="${item.id}">UNIT ${unitNumber(item.id)} · ${meta[item.id].short} · ${item.questions.length} 題</option>`).join('');$('lessonPicker').value=lesson;$('crumb').textContent='UNIT '+unitNumber(lesson)+' / '+m.short;$('eyebrow').textContent=m.en;$('lessonTitle').textContent=m.title;$('lessonSub').textContent=m.sub;$('lessonCount').textContent=c.questions.length;$('guideText').textContent=m.guide;$('sourceLabel').textContent='目前來源：'+c.source;refreshFilters();
 $('courseMenu').innerHTML=COURSES.map(item=>`<button class="course-nav ${item.id===lesson?'active':''}" data-lesson="${item.id}" aria-pressed="${item.id===lesson}"><span class="course-copy"><span class="unit-number">UNIT ${unitNumber(item.id)}</span><span class="unit-row"><strong>${meta[item.id].short}</strong><span class="unit-count">${item.questions.length} 題</span></span><small class="unit-en">${meta[item.id].en}</small></span></button>`).join('');
 $('lessonTabs').innerHTML=COURSES.map(item=>`<button class="lesson-tab ${item.id===lesson?'active':''}" data-lesson="${item.id}" aria-pressed="${item.id===lesson}"><span class="tabtop"><span>${item.id}</span><small>${item.questions.length} 題</small></span><strong>${meta[item.id].short}</strong></button>`).join('');
 render();}
function renderChapters(){$('chapterSelect').value=chapter;}
function answerMarkup(q,id){return `<div class="answer" id="answer-${id}"><div><strong>${window.courseQuestionTools.answerLabel(q)}</strong><br><span class="answer-value">${highlighted(q.a)}</span></div><div class="explain"><strong>解析</strong><div class="explanation-text">${window.courseQuestionTools.explanationMarkup(q, highlighted)}</div></div>${q.note?`<div class="warning"><strong>觀念提醒：</strong>${highlighted(q.note)}</div>`:q.warn?'<div class="warning">原資料已標記此題需要核對；請搭配原題、完整選項或老師的說明確認。</div>':''}${window.courseQuestionTools.reviewMarkup(q)}</div>`;}
function questionImagesMarkup(q){return window.courseQuestionTools.questionImagesMarkup(q);}
function cardMarkup({q,id,i,unit}){const isPractice=mode==='practice',open=isPractice?revealed.has(id):$('showAnswers').checked||revealed.has(id);const opts=q.opts||[],chosen=selections.get(id)||[];let options='';if(opts.length){options=`<div class="options">${opts.map((o,k)=>isPractice?`<label class="option ${chosen.includes(k)?'chosen':''}"><input type="${kind(q)==='多選題'?'checkbox':'radio'}" name="choice-${id}" data-choice="${id}" data-index="${k}" ${chosen.includes(k)?'checked':''}><span>${highlighted(o)}</span></label>`:`<div class="option">${highlighted(o)}</div>`).join('')}</div>`;}
 const pending=window.courseQuestionTools.qualityReasons(q,'algorithms').length>0;
 const f=feedback.get(id);return `<article class="card" data-id="${id}"><div class="cardtop"><div class="badges">${allUnits()?`<span class="badge unit-badge">UNIT ${unitNumber(unit.id)} · ${esc(meta[unit.id].short)}</span>`:''}<span class="badge">${highlighted(q.category)}</span><span class="badge neutral">${highlighted(kind(q))}</span>${q.exact?'<span class="badge gold">注意答案格式</span>':''}${pending?'<span class="badge gold">待確認</span>':''}</div><span class="qid">#${String(i+1).padStart(3,'0')}</span></div><h3 class="question" tabindex="-1">${highlighted(q.q)}</h3>${window.courseQuestionTools.searchMatchMarkup(q, $('search').value)}${window.courseQuestionTools.qualityMarkup(q,'algorithms')}${isMissing(q)&&!q.missingContext?'<div class="warning" style="margin-bottom:12px">原資料未附完整題圖或對應虛擬碼，無法單憑此文字獨立重建題目。請搭配原始教材。</div>':''}${questionImagesMarkup(q)}${options}${!opts.length&&!/填空/.test(q.type)?'<p class="missing">請以文字作答，並對照題庫答案與解析。</p>':''}${isPractice&&!opts.length?`<textarea class="entry" data-draft="${id}" aria-label="${id} 你的答案" placeholder="先寫下你的答案或解題想法…">${esc(drafts.get(id)||'')}</textarea>`:''}${!isPractice&&$('showAnswers').checked?'':`<button class="reveal" data-reveal="${id}" aria-controls="answer-${id}" aria-expanded="${open}">${open?'收起答案':isPractice?'對照答案與解析':'查看答案與解析'}</button>`}${isPractice&&f&&open?window.coursePractice.markup(f,id):''}<div ${open?'':'hidden'} data-answer="${id}">${answerMarkup(q,id)}</div></article>`;}
function render(){renderChapters();$('typeSelect').value=type;const items=selectedItems(),entries=scopedEntries(),pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));page=Math.min(page,pages);totalPages=pages;const start=(page-1)*PAGE_SIZE;$('qualitySelect').options[1].textContent=`待確認（${entries.filter(({q})=>window.courseQuestionTools.qualityReasons(q,'algorithms').length).length} 題）`;$('resultSummary').innerHTML=`<strong>${allUnits()?'全部單元':'目前單元'} · ${esc(chapter==='全部'?'全部章節':chapter)}</strong> · ${items.length} / ${entries.length} 題`;$('rangeSummary').textContent=items.length?`${start+1}–${Math.min(start+PAGE_SIZE,items.length)} · 第 ${page} / ${pages} 頁`:'0 題';$('list').innerHTML=items.slice(start,start+PAGE_SIZE).map(cardMarkup).join('');$('empty').hidden=items.length!==0;$('pager').innerHTML=pages>1?`<button data-page="${page-1}" aria-label="上一頁" ${page===1?'disabled':''}>←</button>`+Array.from({length:pages},(_,i)=>`<button data-page="${i+1}" ${page===i+1?'class="active" aria-current="page"':''} aria-label="第 ${i+1} 頁">${i+1}</button>`).join('')+`<button data-page="${page+1}" aria-label="下一頁" ${page===pages?'disabled':''}>→</button>`:'';$('studyMode').classList.toggle('active',mode==='study');$('practiceMode').classList.toggle('active',mode==='practice');$('studyMode').setAttribute('aria-pressed',mode==='study');$('practiceMode').setAttribute('aria-pressed',mode==='practice');$('answerToggle').hidden=mode==='practice';$('modeHint').hidden=mode!=='practice';window.learningUI?.refresh();}
function changeLesson(next){if(next===lesson)return;lesson=next;page=1;if(!allUnits())$('search').value='';revealed.clear();setupLesson();}
function resetFilters(){window.learningUI?.clearReview();chapter='全部';type='全部';page=1;$('search').value='';$('qualitySelect').value='all';render();}
function switchMode(next){mode=next;revealed.clear();feedback.clear();render();}
function toggleAnswer(id,button) {
 const card=button.closest('.card'),panel=card.querySelector('[data-answer]'),open=panel.hidden;
 panel.hidden=!open;button.setAttribute('aria-expanded',String(open));
 button.textContent=open?'收起答案':mode==='practice'?'對照答案與解析':'查看答案與解析';
 if(open)revealed.add(id);else revealed.delete(id);
 card.querySelector('.practice-feedback')?.remove();
 if(mode==='practice'&&open) {
  const q=findEntry(id).q;
  const result=window.coursePractice.evaluate(q.a,q.opts||[],selections.get(id)||[],q);
  feedback.set(id,result);window.coursePractice.show(card,result,id);
 }
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.lesson)changeLesson(b.dataset.lesson);else if(b.dataset.chapter){chapter=b.dataset.chapter;page=1;render();}else if(b.dataset.page){page=Number(b.dataset.page);render();window.courseQuestionTools.focusResults();}else if(b.dataset.reveal)toggleAnswer(b.dataset.reveal,b);});
$('search').addEventListener('input',()=>{page=1;render();});$('chapterSelect').addEventListener('change',e=>{chapter=e.target.value;page=1;render();});$('typeSelect').addEventListener('change',e=>{type=e.target.value;page=1;render();});$('showAnswers').addEventListener('change',()=>{revealed.clear();render();});$('clearBtn').onclick=resetFilters;$('emptyReset').onclick=resetFilters;$('studyMode').onclick=()=>switchMode('study');$('practiceMode').onclick=()=>switchMode('practice');
$('qualitySelect').addEventListener('change',()=>{page=1;render();});
$('searchScopeSelect').addEventListener('change',()=>{page=1;refreshFilters();render();});
$('list').addEventListener('input',e=>{if(e.target.dataset.draft)drafts.set(e.target.dataset.draft,e.target.value);});
$('list').addEventListener('change',e=>{const input=e.target,id=input.dataset.choice;if(!id)return;const k=Number(input.dataset.index);let chosen=selections.get(id)||[];chosen=input.type==='radio'?[k]:input.checked?[...new Set([...chosen,k])]:chosen.filter(i=>i!==k);selections.set(id,chosen);const card=input.closest('.card');card.querySelectorAll('.option').forEach(label=>label.classList.toggle('chosen',label.querySelector('input').checked));revealed.delete(id);feedback.delete(id);card.querySelector('[data-answer]').hidden=true;const b=card.querySelector('[data-reveal]');b.textContent='對照答案與解析';b.setAttribute('aria-expanded','false');card.querySelector('.practice-feedback')?.remove();});
$('lessonPicker').addEventListener('change',e=>changeLesson(e.target.value));
const linkedQuestion=new URLSearchParams(location.search).get('question');
const linkedEntry=findEntry(linkedQuestion);
if(linkedEntry)lesson=linkedEntry.unit.id;
setupLesson();
if(linkedEntry){page=Math.floor(linkedEntry.i/PAGE_SIZE)+1;render();window.courseQuestionTools.focusLinkedQuestion(linkedQuestion);}
window.courseLearning={
 unitIds:()=>current().questions.map((q,i)=>idFor(i)),
 scopeIds:()=>scopedEntries().map(entry=>entry.id),allUnits,
 scopeLabel:()=>allUnits()?`演算法 · 全部 ${COURSES.length} 個單元`:`目前單元 · ${meta[lesson].short}`,
 course:'algorithms', toolbar:document.querySelector('.toolbar'), sidebar:document.querySelector('.sidebar'), list:$('list'),
 cardTop:card=>card.querySelector('.cardtop'), render, resetPage:()=>{page=1;},
 validId:id=>COURSES.some(c=>c.questions.some((q,i)=>questionId(c,i)===id)),
 questionLabel:id=>{const course=COURSES.find(item=>item.questions.some((q,i)=>questionId(item,i)===id));if(!course)return'題目';const index=course.questions.findIndex((q,i)=>questionId(course,i)===id);return meta[course.id].short+' 第 '+String(index+1).padStart(3,'0')+' 題';},
 questionDetails:id=>{const {q,unit,i}=findEntry(id);return {course:'algorithms',id,unit:meta[unit.id].short,number:i+1,question:q.q,answer:q.a};},
 currentPage:()=>page,pageCount:()=>totalPages
};
