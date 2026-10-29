import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseHTML } from 'linkedom';
import { normalizeStem, parseQuestions } from '../assets/batch-model.mjs';

const write = process.argv.includes('--write');
const files = process.argv.slice(2).filter(value => value !== '--write');
if (!files.length) throw new Error('Provide the original HTML question/result files.');
const root = new URL('../', import.meta.url);
const bank = JSON.parse(await readFile(new URL('assets/batch-library.json', root), 'utf8'));
const curation = JSON.parse(await readFile(new URL('assets/os-l9-curation.json', root), 'utf8'));
const key = value => normalizeStem(normalizeStem(value).replace(/___/g, ''));
const candidates = new Map();
function add(stem, source) {
  if (!/_{2,}/.test(stem)) return;
  const signature = key(stem);
  const entries = candidates.get(signature) || [];
  entries.push({ stem, source });
  candidates.set(signature, entries);
}
for (const file of files) {
  const text = await readFile(file, 'utf8');
  if (/\.html?$/i.test(file)) {
    const { document } = parseHTML(text);
    for (const node of document.querySelectorAll('.question-block .question-text')) {
      const inputs = [...node.querySelectorAll('input.text-answer')];
      if (!inputs.length) continue;
      for (const input of inputs) input.replaceWith(document.createTextNode(' ____________ '));
      add(node.textContent.replace(/\s+/g, ' ').trim(), basename(file));
    }
    for (const block of document.querySelectorAll('.question-result')) {
      const paragraph = [...block.querySelectorAll('p')].find(node => /^題目\s*[:：]/.test(node.textContent.trim()));
      if (paragraph) add(paragraph.textContent.replace(/^\s*題目\s*[:：]\s*/, '').trim(), basename(file));
    }
  } else {
    for (const question of parseQuestions(text))
      if (!question.options.length) add(question.stem, basename(file));
  }
}
const changes = [], missing = [], ambiguous = [];
const seen = new Set();
for (const entry of bank.entries) {
  if (entry.course !== 'os' || entry.unit !== 'L9' || entry.options.length || seen.has(entry.id)) continue;
  seen.add(entry.id);
  const matches = candidates.get(key(entry.stem)) || [];
  const versions = new Set(matches.map(item => normalizeStem(item.stem)));
  if (!matches.length) { missing.push({ id: entry.id, stem: entry.stem }); continue; }
  if (versions.size !== 1) { ambiguous.push({ id: entry.id, matches }); continue; }
  const restored = matches[0].stem;
  if (!curation.questions[entry.id]) throw new Error('Missing curation metadata: ' + entry.id);
  changes.push({ id: entry.id, before: entry.stem, after: restored, sources: [...new Set(matches.map(item => item.source))] });
  // Keep the original source fingerprint: only that unchanged source receives this repair.
  curation.questions[entry.id].stem = restored;
  for (const row of bank.entries) if (row.id === entry.id && key(row.stem) === key(restored)) row.stem = restored;
}
if (ambiguous.length) throw new Error(JSON.stringify({ ambiguous }, null, 2));
const report = { restored: changes.length, missing, changes };
console.log(JSON.stringify(report, null, 2));
if (write) {
  if (missing.length) throw new Error('Some blank positions have no source evidence; no files were written.');
  await writeFile(new URL('assets/os-l9-curation.json', root), JSON.stringify(curation, null, 2) + '\n');
  await writeFile(new URL('assets/batch-library.json', root), JSON.stringify(bank) + '\n');
  await writeFile(new URL('docs/l9-fill-blank-restoration.json', root), JSON.stringify(report, null, 2) + '\n');
}
