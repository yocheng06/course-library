import {mkdir,cp,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = process.cwd();
const target = resolve(root, 'artifacts/pages');
const library = new URL('https://course-library-submissions.orange06.workers.dev/course-library/');
const redirects = new Map([
  ['index.html', {path: '', title: '課程首頁'}],
  ['os.html', {path: 'os.html', title: '作業系統題庫'}],
  ['algorithms.html', {path: 'algorithms.html', title: '演算法題庫'}],
  ['batch.html', {path: 'batch.html', title: '批次查題'}],
]);

function redirectPage({path, title}) {
  const destination = new URL(path, library).href;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link rel="canonical" href="${destination}">
  <script>
    const destination = new URL(${JSON.stringify(destination)});
    destination.search = location.search;
    destination.hash = location.hash;
    location.replace(destination.href);
  </script>
  <noscript><meta http-equiv="refresh" content="0;url=${destination}"></noscript>
</head>
<body><noscript><a href="${destination}">${title}</a></noscript></body>
</html>
`;
}

await mkdir(target, {recursive: true});
for (const file of await readdir(root)) {
  if (!file.endsWith('.html')) continue;
  const redirect = redirects.get(file);
  if (redirect) await writeFile(resolve(target, file), redirectPage(redirect));
  else await copyFile(resolve(root, file), resolve(target, file));
}
await cp(resolve(root, 'assets'), resolve(target, 'assets'), {recursive: true});
const version = JSON.parse(await readFile(resolve(target, 'assets/site-version.json'), 'utf8'));
version.sourceRevision = process.env.GITHUB_SHA || 'local-draft';
version.builtAt = new Date().toISOString();
await writeFile(resolve(target, 'assets/site-version.json'), JSON.stringify(version, null, 2) + '\n');
await copyFile(resolve(root, 'README.md'), resolve(target, 'README.md'));
console.log('Pages artifact prepared: ' + target);
