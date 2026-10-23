import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('assets/os-learning.js',root),'utf8');
const bootstrap = readFileSync(new URL('assets/course-bootstrap.js',root),'utf8');
const tick = () => new Promise(resolve=>setImmediate(resolve));

function counts(protocol='https:') {
  const nodes={unitCount:{style:{},setAttribute(){}},unitPicker:{options:[{}]}};
  const total={}, badge={}, unit={questionCount:81,label:'死結'};
  const context={window:{courseContributions:{}},location:{protocol},UNITS:[unit],active:0,
    $:id=>nodes[id],unitNumber:()=> '08',render(){},
    document:{querySelector:()=>total,querySelectorAll:()=>[badge]}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function totalQuestionCount()'),source.indexOf('ensureUnitLoaded(0);')),context);
  context.refreshCourseCount();context.refreshUnitCount();
  return {context,nodes,total,badge,unit};
}

test('initial online counts show a loading label, then the merged 112 without exposing 81 as the total',()=>{
  const ui=counts();
  assert.equal(ui.nodes.unitCount.textContent,'載入中');
  assert.equal(ui.context.questionCountLabel(81),'題數載入中');
  assert.ok(!ui.total.textContent.includes('81'));
  const picker=ui.nodes.unitPicker;
  ui.unit.questionCount=112;
  ui.context.setCountSyncState('ready');
  assert.equal(ui.nodes.unitCount.textContent,112);
  assert.equal(ui.badge.textContent,'112 題');
  assert.ok(ui.total.textContent.includes('112 題'));
  assert.equal(ui.nodes.unitPicker,picker);
});

test('failed sync labels the available count and local files never wait for the network',()=>{
  const ui=counts();ui.context.setCountSyncState('local');
  assert.equal(ui.badge.textContent,'已載入 81 題');
  assert.equal(ui.nodes.unitCount.style.fontSize,'');
  const local=counts('file:');
  assert.equal(local.nodes.unitCount.textContent,81);
  assert.equal(local.context.questionCountLabel(81),'81 題');
});

function syncPage({fetch,online=true,protocol='https:'}) {
  const events=[],listeners={};
  const element=()=>({style:{},setAttribute(){},addEventListener(){},replaceChildren(){},append(){},remove(){},querySelector:()=>null});
  const config={course:'os',validId:()=>false,list:{children:[],querySelector:()=>null},sidebar:{querySelector:()=>null},
    setCountSyncState:state=>events.push(state),
    mergeCommunityQuestions:entries=>{events.push(`merged:${entries.length}`);return {openedLinkedQuestion:false};}};
  const context={window:{courseLearning:config,courseContributions:{apiOrigin:'https://example.invalid'},
      addEventListener:(event,fn)=>{listeners[event]=fn;},scrollTo(){},scrollBy(){}},
    document:{activeElement:null,addEventListener(){},querySelector:()=>element(),createElement:element,createTextNode:text=>text},
    location:{search:'',protocol},navigator:{onLine:online},URLSearchParams,AbortSignal,fetch,scrollX:0,scrollY:0};
  vm.runInNewContext(bootstrap,context);
  return {events,listeners,context};
}

test('slow public sync keeps counts pending and only finishes after merging the response',async()=>{
  let complete;
  const ui=syncPage({fetch:()=>new Promise(resolve=>{complete=resolve;})});
  assert.deepEqual(ui.events,['loading']);
  complete({ok:true,json:async()=>({questions:Array.from({length:31},()=>({}))})});
  await tick();
  assert.deepEqual(ui.events,['loading','merged:31','ready']);
});

for(const [name,fetch] of [
  ['request failure',async()=>{throw new Error('offline');}],
  ['invalid response',async()=>({ok:true,json:async()=>({questions:null})})],
  ['HTTP failure',async()=>({ok:false})],
]) test(`${name} resolves the count to the available data instead of leaving a spinner`,async()=>{
  const ui=syncPage({fetch});await tick();
  assert.deepEqual(ui.events,['loading','local']);
});

test('offline and file URLs resolve immediately without a request; reconnect can retry',async()=>{
  let requests=0;
  const fetch=async()=>{requests++;return {ok:true,json:async()=>({questions:[]})};};
  const offline=syncPage({fetch,online:false});
  assert.deepEqual(offline.events,['local']);assert.equal(requests,0);
  offline.context.navigator.onLine=true;offline.listeners.online();await tick();
  assert.deepEqual(offline.events,['local','loading','merged:0','ready']);
  const local=syncPage({fetch,protocol:'file:'});
  assert.deepEqual(local.events,['local']);assert.equal(requests,1);
});
