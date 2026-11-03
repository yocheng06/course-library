import {cp,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {syncContributionStyles} from '../contribution-service/scripts/shared-frontend.mjs';
import {prepareHealthExplanations} from '../contribution-service/scripts/health-explanations.mjs';
const library=resolve(import.meta.dirname,'..'),service=resolve(library,'contribution-service');
// Application assets only: do not regenerate question identities/catalogs or edit live data.
const files=['submit.html','assets/contributions-submit.js','assets/grouped-submissions.mjs','assets/topic-order.js','assets/question-comparison.mjs','assets/library-health.mjs','assets/library-manager.mjs','assets/unit-manager.mjs','assets/submission-inbox-ui.mjs','assets/contributions-review.js','assets/management.css'];
for(const file of files){const target=resolve(service,'frontend',file);await mkdir(dirname(target),{recursive:true});await cp(resolve(library,file),target);}
await syncContributionStyles(library,service);
await prepareHealthExplanations(library,resolve(service,'content/health-explanations.json'));
console.log(`Prepared ${files.length+1} shared application files (service-owned CSS preserved) and reviewed explanation fallbacks. Question catalogs unchanged.`);
