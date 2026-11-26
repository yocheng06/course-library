import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {verifyDatabaseBackup} from '../scripts/verify-d1-backup.mjs';
const schema=readdirSync(new URL('../contribution-service/drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort().map(n=>readFileSync(new URL('../contribution-service/drizzle/'+n,import.meta.url),'utf8')).join('\n');
import {imageTableSql as imageSchema} from '../contribution-service/worker/d1-image-store.mjs';
const bytes=Buffer.from([137,80,78,71]),sha=createHash('sha256').update(bytes).digest('hex');
test('isolated SQL restoration validates actual question history and every image byte',()=>{
 const sql=schema+';'+imageSchema+`;INSERT INTO image_objects VALUES ('submissions/test/0-0',X'${bytes.toString('hex')}','image/png',4,'${sha}',1);`;
 const report=verifyDatabaseBackup(sql);assert.equal(report.ok,true);assert.equal(report.imagesVerified,1);
 assert.throws(()=>verifyDatabaseBackup(sql.replace(sha,'0'.repeat(64))),/題圖校驗/);
 assert.throws(()=>verifyDatabaseBackup('CREATE TABLE partial(id TEXT)'),/缺少資料表/);
});
