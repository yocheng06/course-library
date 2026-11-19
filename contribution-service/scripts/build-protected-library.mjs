import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const pages = ['index.html', 'os.html', 'algorithms.html', 'batch.html', 'music-player.html'];

export async function buildProtectedLibrary(project, out, origin) {
  const folder = resolve(out, 'library-assets/course-library');
  await mkdir(folder, {recursive: true});
  await cp(resolve(project, 'assets'), resolve(folder, 'assets'), {recursive: true});
  const hashes = {};
  for (const page of pages) {
    const html = await readFile(resolve(project, page), 'utf8');
    const notice = '<p class="muted">此題庫會記錄連線來源 IP 與瀏覽器代號供站主管理存取，訪客紀錄保留 30 天。</p>';
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes, text]) => text.trim() && !/\bsrc\s*=|application\/json/i.test(attributes))
      .map(([, , text]) => "'sha256-" + createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('base64') + "'");
    hashes[page] = inline.join(' ');
    await writeFile(resolve(folder, page === 'index.html' ? 'home.html' : page), page === 'index.html' ? html.replace('</main>', notice + '</main>') : html);
  }
  hashes[''] = hashes['index.html'];
  await writeFile(resolve(folder, 'assets/contributions-config.js'),
    'window.courseContributions=Object.freeze({apiOrigin:' + JSON.stringify(origin) + '});\n');
  return hashes;
}
