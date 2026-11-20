import {mkdir,realpath,rm,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';

const root = await realpath(process.cwd());
const artifacts = join(root, 'artifacts');
const target = join(artifacts, 'pages');
const library = new URL('https://course-library-submissions.orange06.workers.dev/course-library/');
const redirects = new Map([
  ['index.html', {path: '', title: '課程首頁'}],
  ['os.html', {path: 'os.html', title: '作業系統題庫'}],
  ['algorithms.html', {path: 'algorithms.html', title: '演算法題庫'}],
  ['batch.html', {path: 'batch.html', title: '批次查題'}],
  ['music-player.html', {path: 'music-player.html', title: '音樂播放器'}],
  ['submit.html', {path: '/submit', title: '投稿題庫'}],
  ['review.html', {path: '/review', title: '題庫管理'}],
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

await mkdir(artifacts, {recursive: true});
if (await realpath(dirname(target)) !== artifacts) throw new Error('Unexpected Pages output directory');
await rm(target, {recursive: true, force: true});
await mkdir(target);
for (const [file, redirect] of redirects) {
  await writeFile(join(target, file), redirectPage(redirect));
}
console.log('Pages artifact prepared: ' + target);
