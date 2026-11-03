// Private aggregate views. Original catalogs and durable edit/history tables stay intact.
const managementBaseSummaries = BUILTIN_QUESTIONS.map((base) => {
  const q = builtinEditable(base.question);
  return { base, stem: q.stem, category: q.category, type: q.type,
    answer: q.answer, search: (base.id + ' ' + (base.question.aliases || []).join(' ') + ' ' + JSON.stringify(q)).toLocaleLowerCase() };
});
function managementKey(source, course, id) { return source + ':' + course + ':' + id; }
function managementQuestion(raw) {
  return { ...canonicalQuestion(raw), translation: raw.translation || '',
    optionTranslations: Array.isArray(raw.optionTranslations) ? raw.optionTranslations : [],
    note: raw.note || '', answerProvided: raw.answerProvided !== false, submissionReview:raw.submissionReview || null };
}
async function managementSummaries(env, course, query = '') {
  const edits = await env.DB.prepare(`SELECT e.question_id,e.revision,e.action,e.created_at,
    COALESCE(json_extract(e.data,'$.stem'),json_extract(e.data,'$.q'),'') AS stem,
    json_extract(e.data,'$.category') AS category,json_extract(e.data,'$.type') AS type,
    COALESCE(json_extract(e.data,'$.answer'),json_extract(e.data,'$.a'),'') AS answer
    ${query ? ',e.data AS search_text' : ''}
    FROM builtin_question_edits e WHERE e.course=? AND e.revision=(SELECT MAX(h.revision) FROM builtin_question_edits h WHERE h.course=e.course AND h.question_id=e.question_id)`)
    .bind(course).all();
  const byId = new Map(edits.results.map((e) => [e.question_id, e]));
  const rows = managementBaseSummaries.filter((s) => s.base.course === course).map((s) => {
    const e = byId.get(s.base.id), useEdit = e && e.action !== 'reset', deleted = e?.action === 'delete';
    return { key: managementKey('builtin', course, s.base.id), source: 'builtin', course,
      id: s.base.id, unit: s.base.unit, unitTitle: '', stem: useEdit ? e.stem : s.stem,
      category: useEdit ? e.category : s.category, type: useEdit ? e.type : s.type,
      answer: String(useEdit ? e.answer : s.answer).slice(0, 200), revision: e?.revision || 0,
      published: !deleted, deleted, status: deleted ? 'deleted' : 'published',
      hasHistory: Boolean(e), currentOriginal: !e || e.action === 'reset',
      updatedAt: e?.created_at || null,
      _search: query ? (useEdit ? (s.base.id + ' ' + (s.base.question.aliases || []).join(' ') + ' ' + e.search_text).toLocaleLowerCase() : s.search) : '' };
  });
  const canonicalFields = [
    "COALESCE(json_extract(COLUMN,'$.stem'),json_extract(COLUMN,'$.q'),'')",
    "COALESCE(json_extract(COLUMN,'$.answer'),json_extract(COLUMN,'$.a'),'')",
    "COALESCE(json_extract(COLUMN,'$.explanation'),json_extract(COLUMN,'$.ex'),'')",
    "COALESCE(json_extract(COLUMN,'$.options'),json_extract(COLUMN,'$.opts'),'[]')",
    "COALESCE(json_extract(COLUMN,'$.images'),'[]')",
    "COALESCE(json_extract(COLUMN,'$.translation'),'')",
    "COALESCE(json_extract(COLUMN,'$.optionTranslations'),'[]')",
    "COALESCE(json_extract(COLUMN,'$.note'),'')",
    "COALESCE(json_extract(COLUMN,'$.answerProvided'),1)",
    "json_extract(COLUMN,'$.category')", "json_extract(COLUMN,'$.type')",
  ];
  const originalContentComparison = canonicalFields.map((expression) => '(' + expression.replaceAll('COLUMN','h.data') + ' IS ' + expression.replaceAll('COLUMN','p.data') + ')').join(' AND ');
  const community = await env.DB.prepare(`SELECT p.id,p.course,p.unit,p.revision,p.is_published,p.created_at,p.updated_at,
    COALESCE(json_extract(p.data,'$.stem'),json_extract(p.data,'$.q'),'') AS stem,
    json_extract(p.data,'$.category') AS category,json_extract(p.data,'$.type') AS type,
    COALESCE(json_extract(p.data,'$.answer'),json_extract(p.data,'$.a'),'') AS answer,
    json_extract(p.data,'$.unitTitle') AS unit_title,json_extract(p.data,'$.mergedInto') AS merged_into,
    json_extract(p.data,'$.submissionReview.status') AS review_status,
    EXISTS(SELECT 1 FROM question_history h WHERE h.question_id=p.id) AS has_history,
    COALESCE((SELECT (h.course=p.course AND h.unit=p.unit AND ${originalContentComparison}) FROM question_history h WHERE h.question_id=p.id ORDER BY h.revision ASC,h.created_at ASC,id ASC LIMIT 1),1) AS original_content
    ${query ? ',p.data AS search_text' : ''}
    FROM public_questions p WHERE p.course=?`).bind(course).all();
  for (const r of community.results) {
    if (r.merged_into || builtinReference(course, r.id)) continue;
    const deleted = !r.is_published;
    rows.push({ key: managementKey('community', course, r.id), source: 'community', course,
      id: r.id, unit: r.unit, unitTitle: r.unit_title || '', stem: r.stem,
      category: r.category, type: r.type, answer: String(r.answer || '').slice(0, 200),
      revision: r.revision, published: !deleted, deleted, status: deleted ? 'deleted' : 'published',
      hasHistory: Boolean(r.has_history), currentOriginal: Boolean(r.original_content), pendingReview:r.review_status==='pending',
      updatedAt: r.updated_at || r.created_at,
      _search: query ? (r.id + ' ' + r.search_text).toLocaleLowerCase() : '' });
  }
  return rows;
}
async function listManagementLibrary(request, env, url) {
  await owner(request, env);
  await ensureReviewedContent(env);
  const course = url.searchParams.get('course') || 'os', unit = url.searchParams.get('unit') || '',
    state = url.searchParams.get('state') || 'all', source = url.searchParams.get('source') || 'all',
    sort = url.searchParams.get('sort') || 'updated', q = (url.searchParams.get('q') || '').trim().toLocaleLowerCase(),
    cursor = url.searchParams.get('cursor') || '0';
  if (!Object.hasOwn(COURSE_UNITS, course) || !['all','modified','deleted','pending'].includes(state) ||
    !['all','builtin','community'].includes(source) || !['updated','id'].includes(sort) || q.length > 100 ||
    !/^\d{1,6}$/.test(cursor) || unit.length > 30) throw new HttpError(400, '篩選條件不正確。');
  const catalog = await managementSummaries(env, course, q);
  const unitData=await publicUnitCatalog(env,course,true),units=new Map(unitData.units.map(u=>[u.id,u]));
  for (const row of catalog) {
    row.unitLabel = units.get(row.unit)?.label || unitLabel(course,row.unit,row.unitTitle);
    if (!units.has(row.unit)) units.set(row.unit, {id:row.unit,title:row.unitLabel.replace(/^L\d+ · /,''),label:row.unitLabel});
  }
  const matching = catalog.filter((r) => (!unit || r.unit === unit) && (source === 'all' || r.source === source) && (!q || r._search.includes(q)));
  const counts = {all:matching.filter((r) => !r.deleted).length, modified:matching.filter((r) => r.hasHistory).length, deleted:matching.filter((r) => r.deleted).length, pending:matching.filter(r=>r.pendingReview&&!r.deleted).length};
  const rows = matching.filter((r) => state === 'pending' ? r.pendingReview&&!r.deleted : state === 'deleted' ? r.deleted : state === 'modified' ? r.hasHistory : !r.deleted);
  rows.sort((a,b) => (sort === 'updated' ? (b.updatedAt || 0) - (a.updatedAt || 0) : 0) || a.key.localeCompare(b.key));
  const offset = Number(cursor);
  return json({items:rows.slice(offset,offset+25).map(({_search,...row}) => row), counts, units:[...units.values()], total:rows.length,
    nextCursor:offset+25<rows.length ? String(offset+25) : null});
}
async function originalPublication(env, row) {
  const first = await env.DB.prepare('SELECT course,unit,data FROM question_history WHERE question_id=? ORDER BY revision ASC,created_at ASC,id ASC LIMIT 1').bind(row.id).first();
  return first || row;
}
function healthExplanation(course,id,q){
  const source=String(q.explanation??q.ex??'');if(source.trim())return source;
  const meta=HEALTH_EXPLANATIONS[course]?.[id];if(!meta)return source;
  const signatureText=JSON.stringify([String(q.type||''),String(q.stem??q.q??''),q.options??q.opts??[],String(q.answer??q.a??'')]);
  let hash=2166136261;for(let i=0;i<signatureText.length;i++){hash^=signatureText.charCodeAt(i);hash=Math.imul(hash,16777619);}
  const curation=meta.curations?.find(v=>v.sourceSignature===(hash>>>0).toString(16).padStart(8,'0'));
  if(curation)return curation.explanation;
  const images=value=>(value||[]).map(i=>{const src=typeof i==='string'?i:i.src;try{return new URL(src,'https://yocheng06.github.io/course-library/').href;}catch{return src;}});
  const identity=value=>JSON.stringify([String(value.type||''),String(value.stem??value.q??''),value.options??value.opts??[],String(value.answer??value.a??''),images(value.images)]);
  const version=meta.versions?.find(v=>{const [type,stem,options,answer,imgs]=JSON.parse(v.identity);return identity({type,stem,options,answer,images:imgs})===identity(q);});
  return version?.explanation||source;
}
async function managementHealth(request,env,url){
  await owner(request,env);
  const course=url.searchParams.get('course')||'os';
  if(!Object.hasOwn(COURSE_UNITS,course))throw new HttpError(400,'科目不正確。');
  await ensureReviewedContent(env);
  const edits=await latestBuiltinEdits(env,course),items=[];
  const add=(item)=>{if(item.deleted)return;items.push({...item,effectiveExplanation:healthExplanation(course,item.id,item.question),stemKey:builtinSearch.normalizeStem(item.question.stem||item.question.q||''),stemKeys:builtinSearch.questionStemVersions(item.question.stem||item.question.q||'',item.question.translation||'').map(builtinSearch.normalizeStem)});};
  for(const base of BUILTIN_QUESTIONS){if(base.course!==course)continue;const row=builtinRow(base,edits.get(base.id));add({...row,source:'builtin',key:managementKey('builtin',course,base.id)});}
  const result=await env.DB.prepare('SELECT id,course,unit,revision,data,updated_at,created_at FROM public_questions WHERE course=? AND is_published=1 ORDER BY id LIMIT 5001').bind(course).all();
  for(const row of result.results.slice(0,5000)){
    const q=JSON.parse(row.data);if(q.mergedInto||builtinReference(course,row.id))continue;
    add({id:row.id,course,unit:row.unit,unitTitle:q.unitTitle||'',source:'community',key:managementKey('community',course,row.id),revision:row.revision,updatedAt:row.updated_at||row.created_at,question:managementQuestion(q)});
  }
  return json({items,complete:result.results.length<=5000});
}
async function managementLibraryItem(request, env, url) {
  await owner(request, env);
  await ensureReviewedContent(env);
  const course=url.searchParams.get('course'), source=url.searchParams.get('source'), id=url.searchParams.get('id');
  if (!Object.hasOwn(COURSE_UNITS,course) || !['builtin','community'].includes(source) || !id || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new HttpError(400,'題目編號不正確。');
  if (source === 'builtin') {
    const base=builtinBase(course,id), row=builtinRow(base,(await latestBuiltinEdits(env,course)).get(base.id));
    return json({item:{...row,key:managementKey(source,course,base.id),source,published:!row.deleted,hasHistory:row.revision>0,
      currentOriginal:!row.modified&&!row.deleted,original:builtinEditable(base.question)}});
  }
  const row=await env.DB.prepare('SELECT * FROM public_questions WHERE id=? AND course=?').bind(id,course).first();
  if (!row || builtinReference(course,id) || JSON.parse(row.data).mergedInto) throw new HttpError(404,'找不到這道題目。');
  const original=await originalPublication(env,row), item=publicationRow(row);
  return json({item:{...item,key:managementKey(source,course,id),source,deleted:!item.published,hasHistory:original!==row,
    currentOriginal:original.course===row.course&&original.unit===row.unit&&JSON.stringify(managementQuestion(JSON.parse(original.data)))===JSON.stringify(managementQuestion(JSON.parse(row.data))),
      question:managementQuestion(JSON.parse(row.data)),original:managementQuestion(JSON.parse(original.data))}});
}
async function listManagementImports(request, env, url) {
  await owner(request, env);
  const status=url.searchParams.get('status')||'approved',cursor=url.searchParams.get('cursor')||'';
  if(!['approved','pending','rejected'].includes(status)|| (cursor&&!uuid.test(cursor)))
    throw new HttpError(400,'匯入紀錄篩選條件不正確。');
  let rows;
  if(cursor){
    const pivot=await env.DB.prepare('SELECT created_at FROM submissions WHERE id=?').bind(cursor).first();
    if(!pivot)throw new HttpError(400,'匯入紀錄頁碼已失效。');
    rows=await env.DB.prepare(`SELECT id,status,revision,created_at,reviewed_at,note,
      json_extract(payload,'$.course') AS course,json_extract(payload,'$.unit') AS unit,
      json_extract(payload,'$.unitTitle') AS unit_title,json_extract(payload,'$.title') AS title,
      json_array_length(json_extract(payload,'$.questions')) AS question_count
      FROM submissions WHERE status=? AND (created_at<? OR (created_at=? AND id<?))
      ORDER BY created_at DESC,id DESC LIMIT 21`).bind(status,pivot.created_at,pivot.created_at,cursor).all();
  }else{
    rows=await env.DB.prepare(`SELECT id,status,revision,created_at,reviewed_at,note,
      json_extract(payload,'$.course') AS course,json_extract(payload,'$.unit') AS unit,
      json_extract(payload,'$.unitTitle') AS unit_title,json_extract(payload,'$.title') AS title,
      json_array_length(json_extract(payload,'$.questions')) AS question_count
      FROM submissions WHERE status=? ORDER BY created_at DESC,id DESC LIMIT 21`).bind(status).all();
  }
  const page=rows.results.slice(0,20).map(r=>({id:r.id,status:r.status,revision:r.revision,createdAt:r.created_at,
    reviewedAt:r.reviewed_at,note:r.note,course:r.course,unit:r.unit,unitTitle:r.unit_title||'',title:r.title||'',questionCount:Number(r.question_count)||0}));
  if(status==='approved'&&page.length){
    const ids=page.map(r=>r.id),placeholders=ids.map(()=>'?').join(',');
    const result=await env.DB.prepare(`SELECT submission_id,id,is_published,revision,data FROM public_questions WHERE submission_id IN (${placeholders}) ORDER BY submission_id,created_at,id`).bind(...ids).all();
    const bySubmission=new Map();
    for(const publication of result.results){const list=bySubmission.get(publication.submission_id)||[];list.push({id:publication.id,
      questionNumber:Number(publication.id.match(/-(\d+)$/)?.[1])||0,revision:publication.revision,
      published:Boolean(publication.is_published),mergedInto:JSON.parse(publication.data).mergedInto||null});bySubmission.set(publication.submission_id,list);}
    for(const item of page)item.publications=(bySubmission.get(item.id)||[]).sort((a,b)=>a.questionNumber-b.questionNumber);
  }
  return json({items:page,nextCursor:rows.results.length>20?page.at(-1)?.id||null:null});
}
async function managementImportDetail(request,env,id){
  await owner(request,env);
  const row=await env.DB.prepare('SELECT * FROM submissions WHERE id=?').bind(id).first();
  if(!row)throw new HttpError(404,'找不到這筆匯入紀錄。');
  const item=submissionRow(row);
  if(row.status==='approved'){
    const result=await env.DB.prepare('SELECT id,is_published,revision,data FROM public_questions WHERE submission_id=? ORDER BY created_at,id').bind(id).all();
    item.publications=result.results.map(publication=>({id:publication.id,questionNumber:Number(publication.id.match(/-(\d+)$/)?.[1])||0,
      revision:publication.revision,published:Boolean(publication.is_published),mergedInto:JSON.parse(publication.data).mergedInto||null})).sort((a,b)=>a.questionNumber-b.questionNumber);
  }
  return json({item});
}
async function publicLibraryEtag(env, course) {
  const [p,b,units] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n,COALESCE(SUM(revision),0) AS revisions,COALESCE(MAX(COALESCE(updated_at,created_at)),0) AS updated FROM public_questions WHERE course=?').bind(course).first(),
    env.DB.prepare('SELECT COUNT(*) AS n,COALESCE(SUM(revision),0) AS revisions,COALESCE(MAX(created_at),0) AS updated FROM builtin_question_edits WHERE course=?').bind(course).first(),
    unitConfiguration(env,course),
  ]);
  return '"' + await hash(JSON.stringify([LIBRARY_BUILD_REVISION,course,p,b,units.revision])) + '"';
}

// Unit presentation settings are independent of question IDs and answer revisions.
const unitSettingsReady=new WeakMap();
async function ensureUnitSettings(env){
  if(!unitSettingsReady.has(env.DB))unitSettingsReady.set(env.DB,(async()=>{
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS unit_settings (course TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS unit_settings_history (id TEXT PRIMARY KEY, course TEXT NOT NULL, revision INTEGER NOT NULL, before_data TEXT NOT NULL, after_data TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL)').run();
  })().catch(error=>{unitSettingsReady.delete(env.DB);throw error;}));
  await unitSettingsReady.get(env.DB);
}
async function unitConfiguration(env,course){
  await ensureUnitSettings(env);
  const row=await env.DB.prepare('SELECT revision,data FROM unit_settings WHERE course=?').bind(course).first();
  return {revision:row?.revision||0,settings:row?JSON.parse(row.data):[]};
}
function managedUnitLabel(course,id,title){
  const base=COURSE_UNITS[course].units[id];
  return base?.match(/^L\d+/)?.[0] ? base.match(/^L\d+/)[0]+' · '+title : id==='treasure'?title:id+' · '+title;
}
async function publicUnitCatalog(env,course,includeHidden=false){
  const config=await unitConfiguration(env,course);
  const units=new Map(Object.entries(COURSE_UNITS[course].units).map(([id,label])=>[id,{id,title:label.replace(/^L\d+ · /,''),label,order:id==='treasure'?6.5:Number(label.match(/^L(\d+)/)?.[1]||99)}]));
  const rows=await env.DB.prepare("SELECT unit,MIN(json_extract(data,'$.unitTitle')) AS title FROM public_questions WHERE course=?"+(includeHidden?'':' AND is_published=1')+' GROUP BY unit').bind(course).all();
  for(const row of rows.results)if(!units.has(row.unit)){
    const label=unitLabel(course,row.unit,row.title);
    units.set(row.unit,{id:row.unit,title:label.replace(/^L\d+ · /,''),label,order:Number(row.unit.slice(1))||99});
  }
  for(const item of config.settings)units.set(item.id,{...units.get(item.id),...item,label:managedUnitLabel(course,item.id,item.title),managed:true});
  return {revision:config.revision,units:[...units.values()].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))};
}
async function manageUnits(request,env,url){
  const actor=await owner(request,env),course=url.searchParams.get('course')||'os';
  if(!Object.hasOwn(COURSE_UNITS,course))throw new HttpError(400,'科目不正確。');
  if(request.method==='GET')return json(await publicUnitCatalog(env,course,true));
  requireOrigin(request,true);const body=await readBody(request,48000),current=await publicUnitCatalog(env,course,true);
  if(!body||!Number.isSafeInteger(body.revision)||body.revision!==current.revision)throw new HttpError(409,'單元資料已更新，請重新載入後再儲存。');
  if(!Array.isArray(body.units)||body.units.length!==current.units.length)throw new HttpError(400,'請保留所有單元，這裡不能刪除單元。');
  const ids=new Set(current.units.map(u=>u.id)),seen=new Set();
  const next=body.units.map((row,index)=>{
    if(!row||!ids.has(row.id)||seen.has(row.id)||typeof row.title!=='string'||!row.title.trim()||row.title.trim().length>60)throw new HttpError(400,'單元名稱或編號不正確。');
    seen.add(row.id);return {id:row.id,title:row.title.trim(),order:index+1};
  });
  await env.DB.prepare('INSERT OR IGNORE INTO unit_settings(course,revision,data,updated_at) VALUES(?,0,?,0)').bind(course,'[]').run();
  const before=await unitConfiguration(env,course),now=Date.now(),after=JSON.stringify(next);
  const result=await env.DB.batch([
    env.DB.prepare('UPDATE unit_settings SET revision=revision+1,data=?,updated_at=? WHERE course=? AND revision=?').bind(after,now,course,body.revision),
    env.DB.prepare('INSERT INTO unit_settings_history(id,course,revision,before_data,after_data,actor,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),course,body.revision+1,JSON.stringify(before.settings),after,actor,now),
  ]);
  if(!result[0].meta.changes)throw new HttpError(409,'單元資料已更新，請重新載入。');
  return json(await publicUnitCatalog(env,course,true));
}
