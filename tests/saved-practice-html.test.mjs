import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {parseBatchInput} from '../assets/batch-import.mjs';
const raw=await readFile(new URL('fixtures/saved-practice-form.html',import.meta.url),'utf8');
const {document}=parseHTML('<html><body></body></html>');
test('saved practice HTML imports all 30 numbered questions, retains blanks and uses visible option order',()=>{
 const result=parseBatchInput(raw,{name:'practice.html',document});
 assert.equal(result.questions.length,30);
 assert.deepEqual(result.questions.map(q=>q.number),Array.from({length:30},(_,i)=>String(i+1)));
 assert.ok(result.questions.every(q=>!q.issues.length));
 assert.match(result.questions[0].stem,/^_{2,} 是測試題目 1/);
 assert.match(result.questions[3].stem,/^_{2,} 是測試題目 4/);
 assert.match(result.questions[2].stem,/Synthetic case 3 needs\s+_{2,}/);
 assert.deepEqual(result.questions[1].options.map(o=>o.label),['A','B','C','D']);
 assert.equal(result.questions[1].options[0].text,'測試選項甲');
 assert.ok(!result.text.includes('Unnumbered page content'));
 assert.ok(!result.text.includes('999. hidden'));
 assert.ok(!document.querySelector('.question-block'));
});
test('saved fill answers and checked radio values never become question content or bank answers',()=>{
 const changed=raw.replaceAll('value="" type="text"','value="SECRET-SAVED-ANSWER" type="text"').replace('<meta charset="utf-8">','<meta charset="utf-8"><script>window.importMustNotRun=true</script>');
 const result=parseBatchInput(changed,{name:'practice.html',document});
 assert.equal(result.questions.length,30);assert.ok(!result.text.includes('SECRET-SAVED-ANSWER'));
 assert.equal(document.defaultView.importMustNotRun,undefined);
});
