import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const source=readFileSync(new URL('../assets/scheduling-walkthrough.js',import.meta.url),'utf8');
test('timeline buttons scroll their own timeline in both directions and clamp at either end',()=>{
 const {window,document}=parseHTML('<html><body></body></html>');
 vm.runInNewContext(source,{window,document});
 const data={title:'測試',rule:'規則',columns:['程序'],rows:[['P1']],segments:[{name:'P1',start:0,end:5}],timelines:[{label:'第二條時間線',segments:[{name:'P2',start:0,end:4}]}]};
 document.body.innerHTML=window.courseSchedulingWalkthrough.markup(data);
 const tracks=[...document.querySelectorAll('.worked-timeline')];
 assert.equal(tracks.length,2);
 const regions=tracks.map(t=>t.querySelector('.worked-scroll'));
 for(const scroll of regions){Object.defineProperty(scroll,'clientWidth',{value:300});Object.defineProperty(scroll,'scrollWidth',{value:1000});scroll.scrollLeft=0;}
 const click=(track,d)=>track.querySelector(`[data-timeline-scroll="${d}"]`).dispatchEvent(new window.Event('click',{bubbles:true}));
 click(tracks[0],1);assert.equal(regions[0].scrollLeft,240);assert.equal(regions[1].scrollLeft,0);
 click(tracks[0],-1);assert.equal(regions[0].scrollLeft,0);click(tracks[0],-1);assert.equal(regions[0].scrollLeft,0);
 for(let i=0;i<8;i++)click(tracks[1],1);assert.equal(regions[1].scrollLeft,700);assert.equal(regions[0].scrollLeft,0);
 for(const r of regions){assert.equal(r.getAttribute('tabindex'),'0');assert.equal(r.getAttribute('role'),'region');}
});
