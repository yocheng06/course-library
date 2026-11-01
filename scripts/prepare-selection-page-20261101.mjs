import {readFile,writeFile} from 'node:fs/promises';
const curation=JSON.parse(await readFile('assets/algorithms-l7-curation.json','utf8'));
const live=JSON.parse(await readFile('content/algorithms-public-l7-20261101.json','utf8'));
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
let html=await readFile('algorithms.html','utf8');
const script='<script id="course-algorithms-l7-curation" type="application/json">'+json(curation)+'</script>';
if(html.includes('id="course-algorithms-l7-curation"'))html=html.replace(/<script id="course-algorithms-l7-curation" type="application\/json">[\s\S]*?<\/script>/,()=>script);
else html=html.replace(/(?=<script src="assets\/algorithms-learning\.js)/,()=>script+'\n<script src="assets/selection-explanations.js?v=l7-rewrite-20261101"></script>\n');
if(!html.includes('assets/selection-explanations.css'))html=html.replace('<link rel="stylesheet" href="assets/theme.css','<link rel="stylesheet" href="assets/selection-explanations.css?v=l7-rewrite-20261101">\n<link rel="stylesheet" href="assets/theme.css');
html=html.replace(/assets\/algorithms-learning\.js\?[^" ]+/g,'assets/algorithms-learning.js?v=l7-rewrite-20261101');
const snapshot=JSON.parse(html.match(/<script id="course-community-snapshot" type="application\/json">(.*?)<\/script>/s)[1]);
snapshot.generatedAt=new Date().toISOString();snapshot.data={questions:live.questions,aliases:live.aliases||[],overrides:live.overrides};
html=html.replace(/(<script id="course-community-snapshot" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+json(snapshot)+b);
await writeFile('algorithms.html',html);await writeFile('assets/course-snapshots/algorithms.json',json(snapshot)+'\n');
let js=await readFile('assets/algorithms-learning.js','utf8');
if(!js.includes('courseSelection?.apply')){
 js=js.replace("for(const unit of COURSES)if(unit.id==='L6')unit.questions=unit.questions.map(q=>window.courseCountingSort?.apply(q)||q);", "function applyReviewedExplanations(q){const reviewed=window.courseCountingSort?.apply(q)||q;return window.courseSelection?.apply(reviewed)||reviewed;}\nfor(const unit of COURSES)if(unit.id==='L6'||unit.id==='L7')unit.questions=unit.questions.map(applyReviewedExplanations);");
 js=js.replace('next.set(id,window.courseCountingSort?.apply(q)||q);','next.set(id,applyReviewedExplanations(q));');
 js=js.replace('const q=window.courseCountingSort?.apply(entry.question)||entry.question;','const q=applyReviewedExplanations(entry.question);');
 js=js.replace("q.countingExplanation?'counting-explanation':''", "q.countingExplanation?'counting-explanation':q.selectionExplanation?'selection-explanation':''");
}
await writeFile('assets/algorithms-learning.js',js);
console.log('Embedded guarded L7 explanations, preserved original questions and refreshed public snapshot.');
