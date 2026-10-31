import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {parseBatchInput} from '../assets/batch-import.mjs';

test('saved challenge controls do not replace grouped questions with an empty array', () => {
  const html=`<script>const questions=[];throw new Error('do not execute')</script>
  <form id="challenge-quiz-form"><div class="question-block group-block">
  <div class="group-stem">共同條件<table><tr><th>Process</th><th>Burst</th></tr><tr><td>P1</td><td>24</td></tr></table></div>
  <div class="sub-question-block"><p class="question-text">1.</p><div class="question-text">排程順序
  <input class="text-answer" type="text" value="saved-secret">
  請依格式回答</div></div>
  <div class="sub-question-block"><p class="question-text">2. 選擇結果？</p><label><input type="radio" value="D">A. 第一個</label><label><input type="radio" value="B">B. 第二個</label></div>
  </div></form>`;
  const doc=parseHTML('<html><body></body></html>').document;
  const result=parseBatchInput(html,{name:'challenge.html',document:doc});
  assert.equal(result.questions.length,2);
  for(const q of result.questions){assert.match(q.stem,/共同條件/);assert.match(q.stem,/Process\s+Burst/);assert.match(q.stem,/P1\s+24/);assert.doesNotMatch(q.stem,/saved-secret|do not execute/);}
  assert.match(result.questions[0].stem,/排程順序\s+____________\s+請依格式回答/);
  assert.deepEqual(result.questions[1].options.map(o=>o.text),['第一個','第二個']);
});

test('challenge images stay explicitly unresolved rather than silently removed',()=>{
  const html='<form id="challenge-quiz-form"><div class="question-block group-block"><div class="group-stem"><img src="figure.png">共用條件</div><div class="sub-question-block"><div class="question-text">計算平均值<input class="text-answer" type="text"></div></div></div></form>';
  const result=parseBatchInput(html,{name:'challenge.html',document:parseHTML('<html><body></body></html>').document});
  assert.match(result.questions[0].stem,/題圖未轉錄/);
  assert.ok(result.questions[0].issues.length);
});
