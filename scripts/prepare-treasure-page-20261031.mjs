import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('os.html','utf8');
const curation=JSON.parse(await readFile('assets/os-treasure-curation.json','utf8'));
const source=JSON.parse(await readFile('content/treasure-public-review-20261031.json','utf8'));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
html=html.replace(/(<script id="course-os-treasure-curation" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+json(curation)+b);
html=html.replace(/(<script id="course-community-snapshot" type="application\/json">)([\s\S]*?)(<\/script>)/,(_,a,text,b)=>{
 const snapshot=JSON.parse(text);snapshot.data.questions=snapshot.data.questions.filter(r=>r.unit!=='treasure').concat(source.rows);snapshot.treasureRefreshedAt=source.fetchedAt;return a+json(snapshot)+b;
});
if(!html.includes('assets/scheduling-walkthrough.css'))html=html.replace('<link rel="stylesheet" href="assets/theme.css', '<link rel="stylesheet" href="assets/scheduling-walkthrough.css?v=treasure-worked-20261031">\n<link rel="stylesheet" href="assets/theme.css');
if(!html.includes('assets/scheduling-walkthrough.js'))html=html.replace('<script src="assets/os-learning.js','<script src="assets/scheduling-walkthrough.js?v=treasure-worked-20261031"></script>\n<script src="assets/os-learning.js');
html=html.replace(/(assets\/(?:os-learning|course-bootstrap)\.js)\?[^" ]+/g,'$1?v=treasure-worked-20261031');
await writeFile('os.html',html);
let js=await readFile('assets/os-learning.js','utf8');
const old='${window.courseQuestionTools.explanationMarkup(q, highlighted)}';
const replacement='${window.courseSchedulingWalkthrough?.markup(q.workedSolution)||\'\'}<div class="${q.workedSolution?\'worked-explanation\':\'\'}">${window.courseQuestionTools.explanationMarkup(q, highlighted)}</div>';
if(!js.includes('courseSchedulingWalkthrough')){if(!js.includes(old))throw Error('Missing explanation render point');js=js.replace(old,replacement);await writeFile('assets/os-learning.js',js);}
const snapshotPath='assets/course-snapshots/os.json';
const snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));snapshot.data.questions=snapshot.data.questions.filter(r=>r.unit!=='treasure').concat(source.rows);snapshot.treasureRefreshedAt=source.fetchedAt;await writeFile(snapshotPath,json(snapshot)+'\n');
console.log(`Prepared ${curation.order.length} treasure explanations with current public rows.`);
