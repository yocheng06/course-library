import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTap} from '../scripts/check-release.mjs';
test('release gate permits only named baseline failures and rejects unexpected or incomplete results',()=>{
 const tap='not ok 1 - old issue\nok 2 - new feature\n# tests 2\n# pass 1\n# fail 1\n';
 const known=[{name:'old issue'}],result=analyzeTap(tap,known);assert(result.complete);assert.equal(result.unexpected.length,0);assert.equal(result.knownFailures.length,1);
 assert.equal(analyzeTap(tap.replace('old issue','new regression'),known).unexpected.length,1);
 assert.equal(analyzeTap('process crashed',known).complete,false);
 assert.equal(analyzeTap(tap.replace('# fail 1','# fail 2'),known).complete,false);
});
