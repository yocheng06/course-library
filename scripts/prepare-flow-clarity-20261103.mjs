import {cp, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
const root = resolve(import.meta.dirname, '..');
// Application assets only. Do not regenerate question IDs or backend catalogs.
const files = ['submit.html', 'assets/theme.js', 'assets/contributions-submit.js', 'assets/grouped-submissions.mjs', 'assets/unit-catalog.mjs', 'assets/unit-catalog-snapshot.mjs', 'assets/ui-consistency.css'];
for (const file of files) {
  const target = resolve(root, 'contribution-service/frontend', file);
  await mkdir(dirname(target), {recursive: true});
  await cp(resolve(root, file), target);
}
console.log(`Prepared ${files.length} shared frontend files; service-owned styles and question data preserved.`);
