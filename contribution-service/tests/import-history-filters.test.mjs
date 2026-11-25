import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';

test('management import filters search the whole history and retain cursor and Taipei dates',async()=>{
  const source=await readFile(new URL('../worker/library-management.js',import.meta.url),'utf8');
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE submissions(id TEXT,status TEXT,revision INTEGER,created_at INTEGER,reviewed_at INTEGER,note TEXT,payload TEXT); CREATE TABLE public_questions(submission_id TEXT,id TEXT,is_published INTEGER,revision INTEGER,data TEXT,created_at INTEGER);');
    const insert=db.prepare("INSERT INTO submissions VALUES(?, 'approved', 1, ?, null, '', ?)");
    for(let i=1;i<=25;i++){
      const id='00000000-0000-4000-8000-'+String(i).padStart(12,'0');
      const at=Date.parse('2026-11-25T00:00:00+08:00')+(i===25?-1:i);
      insert.run(id,at,JSON.stringify({course:i===24?'algorithms':'os',unit:i===23?'L9':'deadlocks',title:'資料',source:'題目 HTML',questions:[]}));
    }
    const context={
      owner:async()=>{},uuid:/^[0-9a-f-]{36}$/,json:value=>value,
      HttpError:class extends Error{constructor(status,message){super(message);this.status=status;}},
    };
    vm.runInNewContext(source.slice(source.indexOf('async function listManagementImports('),source.indexOf('async function managementImportDetail('))+';this.list=listManagementImports;',context);
    const env={DB:{prepare:sql=>({bind:(...args)=>({
      all:()=>({results:db.prepare(sql).all(...args)}),
      first:()=>db.prepare(sql).get(...args),
    })})}};
    const url=new URL('https://test.invalid/api/manage/imports');
    url.search=new URLSearchParams({course:'os',unit:'deadlocks',q:'題目 html',from:'2026-11-25',to:'2026-11-25'});
    const page=await context.list({},env,url);
    assert.equal(page.items.length,20);
    assert.equal(page.items[0].id.endsWith('022'),true);
    url.searchParams.set('cursor',page.nextCursor);
    const rest=await context.list({},env,url);
    assert.equal(rest.items.length,2);
    assert.equal(rest.nextCursor,null);
    url.searchParams.delete('cursor');
    url.searchParams.set('q',rest.items[0].id);
    assert.equal((await context.list({},env,url)).items.length,1);
    url.searchParams.set('to','2026-11-24');
    await assert.rejects(context.list({},env,url),/起始日期/);
  } finally { db.close(); }
});
