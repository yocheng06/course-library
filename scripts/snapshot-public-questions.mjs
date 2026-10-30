import {readFile, writeFile, mkdir} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const origin = 'https://course-library-submissions-yocheng06.yocheng06.chatgpt.site';
const generatedAt = new Date().toISOString();
// Only the anonymous public endpoint belongs in GitHub; never export management data.
const snapshots = await Promise.all(['os', 'algorithms'].map(async course => {
  const response = await fetch(`${origin}/api/questions?course=${course}`, {signal:AbortSignal.timeout(30000), cache:'no-store'});
  if (!response.ok) throw new Error(`${course}: public endpoint returned ${response.status}`);
  const raw = await response.json();
  if (!['questions','aliases','overrides'].every(key => Array.isArray(raw[key]))) throw new Error(`${course}: incomplete public response`);
  const data = {questions:raw.questions, aliases:raw.aliases, overrides:raw.overrides};
  const curation = course === 'os' ? JSON.parse(await readFile(new URL('assets/os-l9-curation.json', root), 'utf8')) : null;
  return {schema:1, course, generatedAt, data, curation};
}));
await mkdir(new URL('assets/course-snapshots/', root), {recursive:true});
for (const snapshot of snapshots) {
  const filename = snapshot.course === 'os' ? 'os.html' : 'algorithms.html';
  const path = new URL(filename, root);
  let html = await readFile(path, 'utf8');
  const script = `<script id="course-community-snapshot" type="application/json">${JSON.stringify(snapshot).replace(/</g, '\\u003c')}</script>`;
  if (html.includes('id="course-community-snapshot"')) html = html.replace(/<script id="course-community-snapshot" type="application\/json">[\s\S]*?<\/script>/, () => script);
  else {
    if (!html.includes('<script src="assets/course-bootstrap.js?')) throw new Error(`${filename}: missing bootstrap`);
    html = html.replace(/(?=<script src="assets\/course-bootstrap\.js\?)/, () => script + '\n');
  }
  if (snapshot.course === 'os') {
    const curation = JSON.parse(await readFile(new URL('assets/os-basics-curation.json', root), 'utf8'));
    const curationScript = `<script id="course-os-basics-curation" type="application/json">${JSON.stringify(curation).replace(/</g, '\\u003c')}</script>`;
    if (html.includes('id="course-os-basics-curation"')) html = html.replace(/<script id="course-os-basics-curation" type="application\/json">[\s\S]*?<\/script>/, () => curationScript);
    else {
      if (!html.includes('<script src="assets/course-bootstrap.js?')) throw new Error(`${filename}: missing bootstrap`);
      html = html.replace(/(?=<script src="assets\/course-bootstrap\.js\?)/, () => curationScript + '\n');
    }
    const architectureCuration = JSON.parse(await readFile(new URL('assets/os-architecture-curation.json', root), 'utf8'));
    const architectureScript = `<script id="course-os-architecture-curation" type="application/json">${JSON.stringify(architectureCuration).replace(/</g, '\\u003c')}</script>`;
    if (html.includes('id="course-os-architecture-curation"')) html = html.replace(/<script id="course-os-architecture-curation" type="application\/json">[\s\S]*?<\/script>/, () => architectureScript);
    else {
      if (!html.includes('<script src="assets/course-bootstrap.js?')) throw new Error(`${filename}: missing bootstrap`);
      html = html.replace(/(?=<script src="assets\/course-bootstrap\.js\?)/, () => architectureScript + '\n');
    }
    const processCuration = JSON.parse(await readFile(new URL('assets/os-process-curation.json', root), 'utf8'));
    const processScript = `<script id="course-os-process-curation" type="application/json">${JSON.stringify(processCuration).replace(/</g, '\\u003c')}</script>`;
    if (html.includes('id="course-os-process-curation"')) html = html.replace(/<script id="course-os-process-curation" type="application\/json">[\s\S]*?<\/script>/, () => processScript);
    else {
      if (!html.includes('<script src="assets/course-bootstrap.js?')) throw new Error(`${filename}: missing bootstrap`);
      html = html.replace(/(?=<script src="assets\/course-bootstrap\.js\?)/, () => processScript + '\n');
    }
    const threadCuration = JSON.parse(await readFile(new URL('assets/os-threads-curation.json', root), 'utf8'));
    const threadScript = `<script id="course-os-threads-curation" type="application/json">${JSON.stringify(threadCuration).replace(/</g, '\\u003c')}</script>`;
    if (html.includes('id="course-os-threads-curation"')) html = html.replace(/<script id="course-os-threads-curation" type="application\/json">[\s\S]*?<\/script>/, () => threadScript);
    else {
      if (!html.includes('<script src="assets/course-bootstrap.js?')) throw new Error(`${filename}: missing bootstrap`);
      html = html.replace(/(?=<script src="assets\/course-bootstrap\.js\?)/, () => threadScript + '\n');
    }
    const schedulingCuration = JSON.parse(await readFile(new URL('assets/os-scheduling-curation.json', root), 'utf8'));
    const schedulingScript = `<script id="course-os-scheduling-curation" type="application/json">${JSON.stringify(schedulingCuration).replace(/</g, '\\u003c')}</script>`;
    if (html.includes('id="course-os-scheduling-curation"')) html = html.replace(/<script id="course-os-scheduling-curation" type="application\/json">[\s\S]*?<\/script>/, () => schedulingScript);
    else {
      if (!html.includes('<script src="assets/course-bootstrap.js?')) throw new Error(`${filename}: missing bootstrap`);
      html = html.replace(/(?=<script src="assets\/course-bootstrap\.js\?)/, () => schedulingScript + '\n');
    }
  }
  await writeFile(new URL(`assets/course-snapshots/${snapshot.course}.json`, root), JSON.stringify(snapshot) + '\n');
  await writeFile(path, html);
  console.log(`${filename}: snapshot ${snapshot.data.questions.length} public questions, ${snapshot.data.overrides.length} built-in revisions`);
}
