import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {choiceAnswerMarkup} from '../assets/batch-answer.mjs';
test('option labels are structural columns; ABCDE inside content never becomes a new option',()=>{
 const options=[{label:'A',text:'不選的內容'},{label:'B',text:'最佳括號化順序(AB)((CD)E)'},{label:'C',text:'計算 ABCDE 的最少乘法次數\n為 78'},{label:'D',text:'最佳括號化順序((AB)C)(DE)'}];
 const original=JSON.stringify(options),{document}=parseHTML(choiceAnswerMarkup(options,'BCD'));
 assert.deepEqual([...document.querySelectorAll('.batch-choice-label')].map(n=>n.textContent),['B.','C.','D.']);
 assert.deepEqual([...document.querySelectorAll('.batch-choice-content')].map(n=>n.textContent),options.slice(1).map(o=>o.text));
 assert.equal(document.querySelectorAll('[role=listitem]').length,3);assert.equal(JSON.stringify(options),original);
});
test('single choices use the same layout and imported markup remains inert',()=>{
 const {document}=parseHTML(choiceAnswerMarkup([{label:'C',text:'<img src=x onerror=bad()> ABCD & 78'}],'C'));
 assert.equal(document.querySelector('img'),null);assert.equal(document.querySelector('.batch-choice-label').textContent,'C.');assert.equal(document.querySelector('.batch-choice-content').textContent,'<img src=x onerror=bad()> ABCD & 78');
 assert.equal(choiceAnswerMarkup([{label:'A',text:'content'}],''),'');
});
