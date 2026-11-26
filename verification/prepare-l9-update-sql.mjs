import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const {questions}=JSON.parse(await readFile(new URL('./algorithm-l9-explanations-draft.json',import.meta.url),'utf8'));
assert.equal(questions.length,53);
assert.equal(new Set(questions.map(q=>q.id)).size,53);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const note='補上演算法 L9 解析與主題分類｜2026-11-26';
const sql=questions.map(q=>{
  assert.ok(q.id.startsWith('community-')&&q.category&&q.explanation&&!q.discrepancy);
  const key=quote(q.id), history=quote(randomUUID()), cat=quote(q.category), description=quote(q.explanation);
  const match=`id=${key} AND course='algorithms' AND unit='L9' AND is_published=1 AND json_extract(data,'$.q')=${quote(q.stem)}
    AND json_extract(data,'$.type')=${quote(q.type)} AND json(json_extract(data,'$.opts'))=${quote(JSON.stringify(q.options))}
    AND json_extract(data,'$.a')=${quote(q.answer)} AND COALESCE(json_extract(data,'$.ex'),'')=${quote(q.previousExplanation)}
    AND COALESCE(json_extract(data,'$.category'),'')=${quote(q.previousCategory||'')}`;
  return `INSERT INTO question_history(id,question_id,revision,course,unit,data,is_published,action,actor,note,created_at)
    SELECT ${history},id,revision,course,unit,data,is_published,'update','站主管理',${quote(note)},unixepoch()*1000
    FROM public_questions WHERE ${match};
  UPDATE public_questions AS q SET data=json_set(data,'$.ex',${description},'$.category',${cat}),revision=revision+1,updated_at=unixepoch()*1000
    WHERE q.id=${key} AND EXISTS(SELECT 1 FROM question_history h WHERE h.id=${history} AND h.question_id=q.id AND h.data=q.data AND h.revision=q.revision AND h.is_published=q.is_published);`;
}).join('\n\n');
const db=new DatabaseSync(':memory:');
try {
  db.exec('CREATE TABLE public_questions(id TEXT, course TEXT, unit TEXT, revision INTEGER, data TEXT, is_published INTEGER, updated_at INTEGER); CREATE TABLE question_history(id TEXT,question_id TEXT,revision INTEGER,course TEXT,unit TEXT,data TEXT,is_published INTEGER,action TEXT,actor TEXT,note TEXT,created_at INTEGER)');
  const insert=db.prepare("INSERT INTO public_questions VALUES(?,'algorithms','L9',1,?,1,0)");
  for(const q of questions)insert.run(q.id,JSON.stringify({q:q.stem,type:q.type,opts:q.options,a:q.answer,ex:q.previousExplanation,category:q.previousCategory,images:['unchanged']}));
  db.exec(sql);
  assert.equal(db.prepare('SELECT count(*) n FROM question_history').get().n,53);
  const rows=new Map(db.prepare('SELECT id,data,revision FROM public_questions').all().map(r=>[r.id,r]));
  for(const q of questions){
    const row=rows.get(q.id),raw=JSON.parse(row.data);
    assert.equal(raw.q,q.stem);assert.deepEqual(raw.opts,q.options);assert.equal(raw.a,q.answer);
    assert.equal(raw.ex,q.explanation);assert.equal(raw.category,q.category);
    assert.deepEqual(raw.images,['unchanged']);assert.equal(row.revision,2);
  }
}finally{db.close();}
await writeFile(new URL('./algorithm-l9-update.sql',import.meta.url),sql+'\n','utf8');
console.log('53 changes simulated with history and protected question content.');
