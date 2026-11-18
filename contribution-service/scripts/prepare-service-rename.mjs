import {readFile,writeFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serviceOrigin} from './build-cloudflare.mjs';
const columns={public_questions:['data'],question_history:['data'],submissions:['payload'],builtin_question_edits:['data','previous_data'],question_corrections:['snapshot'],unit_settings:['data'],unit_settings_history:['before_data','after_data']};
const semanticKeys=new Set(['stem','q','answer','a','explanation','ex','translation','category']);
function semantics(value,path='',out=[]){
  if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){
    if(semanticKeys.has(key)&&typeof item==='string')out.push([path+'/'+key,item]);
    else semantics(item,path+'/'+key,out);
  }
  return out;
}
export function renameSql(db,from,to){
  from=serviceOrigin(from);to=serviceOrigin(to);assert.notEqual(from,to);
  const old=from+'/api/image/',next=to+'/api/image/',statements=[],counts={};
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
  const before=new Map(tables.map(name=>[name,db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all()]));
  for(const [table,fields]of Object.entries(columns)){
    if(!before.has(table))continue;
    for(const field of fields){
      const affected=before.get(table).filter(row=>typeof row[field]==='string'&&row[field].includes(old));
      counts[table+'.'+field]=affected.length;
      if(!affected.length)continue;
      for(const row of affected){const after=row[field].replaceAll(old,next);assert(JSON.stringify(semantics(JSON.parse(after)))===JSON.stringify(semantics(JSON.parse(row[field]))),'Question text or teacher answer would change');}
      statements.push(`UPDATE ${table} SET ${field}=replace(${field},'${old}','${next}') WHERE instr(${field},'${old}')>0;`);
    }
  }
  const sql=statements.join('\n')+'\n';db.exec(sql);
  for(const table of tables){
    const expected=before.get(table).map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,columns[table]?.includes(key)&&typeof value==='string'?value.replaceAll(old,next):value])));
    assert(JSON.stringify(db.prepare('SELECT * FROM "'+table.replaceAll('"','""')+'"').all())===JSON.stringify(expected),table+' changed beyond image URLs');
  }
  return {sql,counts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const arg=name=>process.argv[process.argv.indexOf(name)+1];
  for(const name of ['--backup','--from','--to','--output'])if(!process.argv.includes(name))throw Error('Missing '+name);
  const raw=await readFile(arg('--backup'),'utf8'),db=new DatabaseSync(':memory:');db.exec(raw);
  const result=renameSql(db,arg('--from'),arg('--to'));db.close();
  await writeFile(arg('--output'),result.sql,{flag:'wx'});
  console.log(JSON.stringify({counts:result.counts,backupSha256:createHash('sha256').update(raw).digest('hex'),onlyImageUrlsChanged:true}));
}
