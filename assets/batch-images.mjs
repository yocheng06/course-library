// Exact file-content identity only; filenames never establish image identity.
const IMAGE_ISSUE = '題目含未提供的圖片或無法辨識的文字。';
const cache = new Map();
let active = 0;
const waiting = [];
async function imageSlot(task) {
  if (active >= 6) await new Promise(resolve => waiting.push(resolve));
  active++;
  try { return await task(); } finally { active--; waiting.shift()?.(); }
}
export const validImageHashes = hashes => Array.isArray(hashes) && hashes.length > 0 && hashes.length <= 8 && hashes.every(h => /^[a-f0-9]{64}$/.test(h));
export async function imageDigest(bytes) {
  if (!bytes.byteLength || bytes.byteLength > 1024 * 1024) throw Error('每張題圖限 1 MB。');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
}
async function dataDigest(src) {
  if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(src)) return null;
  if (!cache.has(src)) {
    if (cache.size >= 512) cache.clear();
    cache.set(src, Promise.resolve().then(() => {
      const raw = atob(src.slice(src.indexOf(',') + 1));
      return imageDigest(Uint8Array.from(raw, c => c.charCodeAt(0)));
    }).catch(() => null));
  }
  return cache.get(src);
}
async function libraryDigest(src, apiOrigin) {
  if (/^data:/i.test(src)) return dataDigest(src);
  let url;
  try { url = new URL(src); } catch { return null; }
  if (!apiOrigin || url.origin !== apiOrigin || url.protocol !== 'https:' || url.username || url.password || !/^\/api\/image\/[a-f0-9-]+\/\d+-\d+$/.test(url.pathname) || url.search || url.hash) return null;
  if (!cache.has(src)) cache.set(src,imageSlot(async()=>{
    const response=await fetch(src,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok || !/^image\/(?:png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type') || '')) return null;
    return imageDigest(await response.arrayBuffer());
  }).catch(()=>null));
  const hash=await cache.get(src);
  if (!hash) cache.delete(src);
  return hash;
}
export async function fingerprintLibraryImages(data, {apiOrigin=globalThis.window?.courseContributions?.apiOrigin} = {}) {
  async function visit(q) {
    if (!q || typeof q !== 'object') return;
    delete q.imageHashes;
    if (Array.isArray(q.images) && q.images.length && q.images.length <= 8 && !q.missingContext) {
      const hashes = await Promise.all(q.images.map(image => libraryDigest(typeof image === 'string' ? image : image?.src || '', apiOrigin)));
      if (validImageHashes(hashes)) q.imageHashes = hashes;
    }
    for (const variant of q.sourceVariants || []) await visit(variant);
  }
  await Promise.all([...(data.questions || []), ...(data.overrides || [])].map(row => visit(row.question)));
  return data;
}
function pathKey(value) {
  let text = String(value || '').split(/[?#]/)[0].replace(/\\/g,'/');
  try { text = decodeURIComponent(text); } catch {}
  return text.normalize('NFKC').toLowerCase().replace(/^\.\//,'');
}
export async function resolveQuestionImages(questions, files = []) {
  const hashes = new Map();
  async function resolve(src) {
    if (/^data:/i.test(src)) return dataDigest(src);
    const key = pathKey(src), name = key.split('/').at(-1);
    const exact = files.filter(f => pathKey(f.webkitRelativePath || f.name) === key || pathKey(f.webkitRelativePath || f.name).endsWith('/'+key));
    const candidates = exact.length ? exact : files.filter(f => pathKey(f.name) === name);
    if (candidates.length !== 1) return null;
    const file = candidates[0];
    if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 1024 * 1024) return null;
    if (!hashes.has(file)) hashes.set(file, Promise.resolve().then(async () => imageDigest(await file.arrayBuffer())).catch(() => null));
    return hashes.get(file);
  }
  return Promise.all(questions.map(async question => {
    if (!question.imageSources?.length || question.imageSources.length > 8 || (question.stem.match(/\[題圖未轉錄\]/g)||[]).length !== question.imageSources.length) return question;
    const imageHashes = await Promise.all(question.imageSources.map(resolve));
    if (!validImageHashes(imageHashes)) return question;
    const unresolved = /\[(?:看不清楚|無法辨識|圖片|題圖)[^\]]*\]/.test(question.stem.replaceAll('[題圖未轉錄]','') + question.options.map(o=>o.text).join(''));
    return {...question, imageHashes, stem:question.stem.replaceAll('[題圖未轉錄]','[題圖已載入]'), issues:unresolved ? question.issues : question.issues.filter(issue => issue !== IMAGE_ISSUE)};
  }));
}
export const imageQuestionKey = q => JSON.stringify([q.number,q.stem,q.options]);
export function inheritQuestionImages(questions, saved = []) {
  const byKey = new Map(saved.filter(q => validImageHashes(q.imageHashes)).map(q => [imageQuestionKey(q),q.imageHashes]));
  return questions.map(q => validImageHashes(q.imageHashes) ? q : byKey.has(imageQuestionKey(q)) ? {...q,imageHashes:byKey.get(imageQuestionKey(q))} : q);
}
