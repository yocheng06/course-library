import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBatch,normalizeUnit,unitLabel} from '../assets/contribution-model.js';
import {groupImport} from '../assets/grouped-submissions.mjs';
const q={category:'新章節',type:'填空題',stem:'第七章的測試問題',answer:'answer',images:[]};
const payload={course:'algorithms',unit:'L7',unitTitle:'動態規劃',title:'第七章投稿',questions:[q]};
test('future numbered units normalize with reviewed names and safe fallbacks',()=>{
 const result=normalizeBatch(payload);assert.equal(result.unit,'L7');assert.equal(result.unitTitle,'動態規劃');
 assert.equal(normalizeBatch({...payload,unit:'7',unitTitle:''}).unitTitle,'第 7 單元');
 assert.equal(unitLabel('algorithms','L7','動態規劃'),'L7 · 動態規劃');
 assert.equal(normalizeUnit('os','L7'),'synchronization');
 assert.equal(normalizeUnit('algorithms','l07'),'L7');
 assert.throws(()=>normalizeBatch({...payload,unit:'L100'}),/1–99/);
 assert.throws(()=>normalizeBatch({...payload,unit:'__proto__'}),/1–99/);
 assert.throws(()=>normalizeBatch({...payload,course:'__proto__'}),/科目/);
 assert.throws(()=>normalizeBatch({...payload,unitTitle:'a'.repeat(61)}),/60/);
});
test('mixed future chapters import into separate groups and retain their names',()=>{
 const groups=groupImport([{...payload},{...payload,unit:'L8',unitTitle:'貪婪演算法',questions:[{...q,stem:'第八章問題'}]}],{course:'algorithms',unit:'L2',title:'多章投稿'});
 assert.deepEqual(groups.map(g=>[g.payload.unit,g.payload.unitTitle]),[['L7','動態規劃'],['L8','貪婪演算法']]);
});
