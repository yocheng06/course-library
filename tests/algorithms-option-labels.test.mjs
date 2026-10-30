import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/algorithms-learning.js',import.meta.url),'utf8');
const escape=text=>String(text??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');const context=vm.createContext({highlighted:escape,esc:escape});
vm.runInContext(source.slice(source.indexOf('function optionContent('),source.indexOf('function cardMarkup(')),context);
test('unlabelled imported algorithm choices show A-D while option text and answer positions stay intact',()=>{
 const options=['比較次數','桶的數量','總位數','處理的位數區段長度'],before=JSON.stringify(options);
 for(const [index,value] of options.entries()){const markup=context.optionContent(value,index);assert.match(markup,new RegExp('>'+String.fromCharCode(65+index)+'\\.</span>'));assert.ok(markup.endsWith(value));}
 assert.equal(JSON.stringify(options),before);
});
test('existing labels are not duplicated and imported text remains escaped',()=>{
 for(const value of ['A. 已標記','A、已標記','A）已標記']){const markup=context.optionContent(value,0);assert.equal((markup.match(/option-label/g)||[]).length,1);assert.equal(markup.includes('A. A'),false);}
 const markup=context.optionContent('<img src=x onerror=alert(1)>',3);assert.ok(markup.includes('D.</span>'));assert.ok(markup.includes('&lt;img'));assert.equal(markup.includes('<img'),false);
});
