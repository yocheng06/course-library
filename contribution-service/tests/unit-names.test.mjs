import test from 'node:test';
import assert from 'node:assert/strict';
import * as server from '../worker/model.js';
import * as client from '../frontend/assets/contribution-model.js';
for(const [name,model] of [['server',server],['client',client]]){
 test(`${name}: memory-management display name preserves the custom unit identity and metadata`,()=>{
  assert.equal(model.unitLabel('os','L9'),'L9 · 記憶體管理');
  assert.equal(model.unitLabel('os','9','第 9 單元'),'L9 · 記憶體管理');
  assert.equal(model.normalizeUnit('os','L9'),'L9');
  const result=model.normalizeBatch({course:'os',unit:'L9',unitTitle:'原有投稿名稱',title:'測試',questions:[{category:'測試',stem:'測試題目',answer:'test',type:'填空題',images:[]}]});
  assert.equal(result.unitTitle,'原有投稿名稱');
  assert.equal(model.unitLabel('os','L10','自訂單元'),'L10 · 自訂單元');
 });
}
