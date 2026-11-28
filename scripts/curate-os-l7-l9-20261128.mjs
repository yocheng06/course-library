import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const writeJson = (path, value) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const htmlPath = 'os.html';
const explanationPath = 'assets/os-content-explanations.json';
const reportPath = 'content/os-l7-l9-review-20261128.json';
const html = read(htmlPath);

function embedded(id) {
  const match = html.match(new RegExp(`<script\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/script>`));
  if (!match) throw new Error(`Missing embedded script: ${id}`);
  return JSON.parse(match[1]);
}

const unitData = {
  synchronization: embedded('course-unit-synchronization'),
  deadlocks: embedded('course-unit-deadlocks'),
};
const snapshotData = embedded('course-community-snapshot').data;
const community = snapshotData.questions;
const manifest = embedded('course-manifest');
const communityById = new Map(community.map(row => [row.question.id, row]));
const explanationData = JSON.parse(read(explanationPath));
const legacyL9 = JSON.parse(read('content/os-l9-explanation-curation-20261118.json'));
const legacyL9ById = new Map(legacyL9.records.map(record => [record.id, record]));

const identity = q => JSON.stringify([
  String(q.type ?? ''),
  String(q.stem ?? q.q ?? ''),
  q.options ?? q.opts ?? [],
  String(q.answer ?? q.a ?? ''),
  q.images ?? [],
]);
const usable = value => {
  const text = String(value ?? '').trim();
  return Boolean(text) && !/^(?:無解析|no|\d+|中文[:：])/i.test(text);
};
const findVersion = q => {
  const source = String(q.explanation ?? q.ex ?? '');
  return explanationData.questions[q.id]?.versions?.find(version =>
    version.identity === identity(q) && [version.sourceExplanation, version.explanation].includes(source),
  );
};
const upsert = (q, { explanation, category }) => {
  const sourceExplanation = String(q.explanation ?? q.ex ?? '');
  const versions = explanationData.questions[q.id]?.versions ?? [];
  let version = versions.find(item => item.identity === identity(q) &&
    [item.sourceExplanation, item.explanation].includes(sourceExplanation));
  if (!version) {
    version = { identity: identity(q), sourceExplanation };
    versions.push(version);
    explanationData.questions[q.id] = { versions };
  }
  if (explanation !== undefined) version.explanation = explanation;
  if (category !== undefined) version.category = category;
};
const getCommunityQuestion = (id, unit) => {
  const row = communityById.get(id);
  if (!row || row.unit !== unit) throw new Error(`Unexpected or missing ${unit} question: ${id}`);
  return row.question;
};

const l7 = {
  'community-d3814130-f8f1-4aa0-9fd8-9684cc7dad92-1': {
    category: 'Semaphore',
    explanation: 'Semaphore 的 wait(x) 會先嘗試取得同步資源；若資源不可用，程序就進入等待。等另一個程序呼叫 signal(x) 後，等待中的程序才有機會恢復執行。因此空格是 signal。這裡的 signal 表示通知／釋放，不是再呼叫一次 wait。',
  },
  'community-d3814130-f8f1-4aa0-9fd8-9684cc7dad92-2': {
    category: 'Bounded-Buffer',
    explanation: '生產者要先確認緩衝區還有空位，所以等待 empty；接著取得 mutex，避免和其他程序同時改動緩衝區。消費者則等待 full，確認至少有一項資料可取。題目問同時使用 wait(empty) 與 wait(mutex) 的程序，因此答案是 producer。',
  },
  'community-d3814130-f8f1-4aa0-9fd8-9684cc7dad92-3': {
    category: 'Semaphore',
    explanation: 'signal(S) 會增加信號量的值，表示可用資源增加或有等待程序能繼續。S-- 會減少計數，屬於 wait 的取得資源方向；while 迴圈則是在忙等，也不是 signal 的定義。',
  },
  'community-d3814130-f8f1-4aa0-9fd8-9684cc7dad92-4': {
    category: 'Dining Philosophers',
    explanation: '監視器可以把筷子狀態與取用規則封裝起來，只有在左右兩根筷子都可用時才允許哲學家進食，並協調等待者。單獨使用一個信號量或自旋鎖只提供同步原語，仍需額外設計完整規則；停用中斷也不是一般多處理器程式可用的解法。',
  },
  'community-84adb18d-2149-4e87-8cdc-cdaff5fa4362-1': {
    category: 'Readers-Writers',
    explanation: '讀者不修改共享資料，因此多位讀者可以同時讀；寫者會改動資料，必須獨占使用權，開始寫入前要等所有讀者離開，也要等其他寫者完成。寫者優先只是某種政策，不是所有解法都如此；寫者不能任意和讀者同時存取。',
  },
  'community-84adb18d-2149-4e87-8cdc-cdaff5fa4362-2': {
    category: 'Monitor',
    explanation: 'Monitor 的全名概念是 abstract data type（抽象資料型別）。它把內部資料與同步操作包在一起，外部程序不能直接碰內部變數，只能透過監視器提供的操作使用共享狀態。',
  },
  'community-84adb18d-2149-4e87-8cdc-cdaff5fa4362-3': {
    category: 'Dining Philosophers',
    explanation: '簡單信號量解法若讓每位哲學家先拿左邊筷子，再等右邊筷子，可能所有人都各拿一根並互相等待。沒有人能拿到第二根，也就沒有人會放下手上的筷子，形成循環等待；這種狀態就是 deadlock。',
  },
  'community-84adb18d-2149-4e87-8cdc-cdaff5fa4362-4': {
    category: 'Readers-Writers',
    explanation: '讀者優先政策可能讓寫者一直等新讀者離開，寫者優先政策也可能讓讀者長期等不到，因此可能發生 starvation。若同步程序以不一致的順序持有多把鎖，也可能互相等待而 deadlock。Livelock 與 priority inversion 不是讀者／寫者問題每種解法必然具有的問題。',
  },
};

const l8 = {
  'community-870107c5-7c5d-431e-aeab-395ac24c57f5-1': '死結預防會用固定規則限制資源取得，破壞死結形成所需條件；這種限制可能讓資源被保留而無法充分使用，所以利用率可能最低。避免法會逐次檢查安全狀態；偵測法先允許分配、之後檢查；恢復法則是在發現死結後處理。',
  'community-870107c5-7c5d-431e-aeab-395ac24c57f5-2': '安全狀態下，系統至少能找到一種程序完成順序。核准新的資源請求會減少可用資源，可能讓所有完成順序都消失，因此可能把狀態由安全變成不安全。釋放資源或程序終止會增加可用資源；「系統已在不安全狀態」也不是從安全狀態轉變的原因。',
  'community-aa4a27e3-5675-4c8a-ac04-0cd199b1c162-1': '死結預防以限制資源申請方式來打破至少一個必要條件。限制可能令資源閒置或讓程序等待，即使系統仍有其他資源也不能立刻使用，所以降低的是 resource utilization。',
  'community-aa4a27e3-5675-4c8a-ac04-0cd199b1c162-2': '避免法會在核准每次請求前動態檢查分配後是否仍安全，並拒絕會令系統失去安全序列的請求，因此可避免死結，且通常比一律嚴格限制資源取得更有彈性、能提高利用率。低開銷不是必然優點，安全性檢查本身需要計算；題目所列優點是動態檢查、較高利用率與保證不進入死結。',
  'community-779bdddf-192c-477b-82c1-77118f21329e-1': '不安全狀態代表目前無法保證所有程序都能依某個安全順序完成，但它還不等於死結。系統之後可能進入死結，也可能出現尚未滿足的資源請求；仍可能有部分程序完成，並釋放資源，所以不能推論所有程序都無法完成或所有資源都被鎖住。',
  'community-779bdddf-192c-477b-82c1-77118f21329e-2': 'CPU 可由排程器停止目前程序並交給另一程序，因此可搶佔；記憶體也能在安全條件下透過換出等方式回收。印表機工作中途被搶走可能留下不完整輸出，檔案操作中途被中斷可能破壞資料或狀態，因此通常不視為可安全搶佔的資源。',
  'community-b40afcfc-800e-4f41-9b83-160a48030bd0-1': '程序終止會停止一個或多個陷入死結的程序，並釋放它們持有的資源，打破等待環。只釋放單一資源、終止資源本身或搶佔資源都不是「中止程序」這個恢復方法。',
  'community-558cfd78-5b14-4834-aef8-2ed654e25558-1': '資源分配圖把程序與資源型別畫成節點，並用兩種方向的邊表示關係：程序指向資源是請求邊，資源指向程序是分配邊。題列的兩種節點與兩種邊都是圖的基本元素。',
  'community-ad550da9-ed22-4683-979b-f032e6a4ee26-1': '選擇要終止的程序時，系統會衡量其優先權、已執行時間、終止與重新執行的成本，以及它目前占用的資源。這些因素會影響解除死結的代價；不是只看程序是否正在執行。',
  'community-ad550da9-ed22-4683-979b-f032e6a4ee26-2': '避免法在每次核准資源前檢查系統是否還有安全序列，只有能保持安全狀態才分配。因此它避免系統進入 unsafe 狀態；unsafe 不等同已發生 deadlock。',
  'community-ad550da9-ed22-4683-979b-f032e6a4ee26-3': '互斥表示某些資源一次只能由一個程序使用。若資源可安全地同時分享，就不再需要互相排斥，因而破壞 mutual exclusion 這個死結必要條件。不過印表機等資源未必能實際共享。',
  'community-75b683e3-febd-4e97-9065-5f358dae04cb-1': '死結偵測可在資源請求無法核准時啟動，也可定期執行，或在系統負載達到門檻時執行，以平衡偵測延遲與檢查成本。系統處於安全狀態本身不需要啟動死結偵測。',
  'community-75b683e3-febd-4e97-9065-5f358dae04cb-2': '預防法靠限制資源取得規則來避免必要條件同時成立，代價可能是效能下降、某些程序長期等不到資源，以及資源利用率降低。複雜度會依採用的限制方法而變，不能一概說一定難實作。',
};

const l8Categories = {
  'community-4c3c7bd2-5b1f-480a-bbd6-12ad0ee2bb3c-3': '死結範例',
  'community-1cb53fa9-7e80-41c0-b9ec-6445d6f13278-3': '死結恢復',
  'community-558cfd78-5b14-4834-aef8-2ed654e25558-1': '資源分配圖',
  'community-779bdddf-192c-477b-82c1-77118f21329e-2': '資源類型',
};

for (const [id, record] of Object.entries(l7)) {
  const q = getCommunityQuestion(id, 'synchronization');
  if (String(q.explanation ?? '').trim()) throw new Error(`L7 explanation already exists; review before replacing: ${id}`);
  upsert(q, record);
}
const diningBase = unitData.synchronization.find(q => q.id === 'os7-009');
if (!diningBase) throw new Error('Could not find os7-009');
upsert(diningBase, {
  category: 'Dining Philosophers',
  explanation: '哲學家平常思考（thinking）；想進食（eating）時，必須同時取得左右兩根筷子。吃完後放下筷子，再回到思考。只拿到一根筷子仍不能吃；若每人都先拿一根再等另一根，就可能形成死結。',
});
for (const [id, explanation] of Object.entries(l8)) {
  const q = getCommunityQuestion(id, 'deadlocks');
  upsert(q, { explanation });
}
for (const [id, category] of Object.entries(l8Categories)) {
  const q = getCommunityQuestion(id, 'deadlocks');
  upsert(q, { category });
}

const l9Rows = community.filter(row => row.unit === 'L9').map(row => row.question);
const l9Differences = { exact: 0, onlyBlankMarkersRemoved: 0 };
const compactWithoutBlankMarkers = value => String(value ?? '')
  .normalize('NFC')
  .replace(/\[__\d+__\]/g, '')
  .replace(/_{2,}/g, '')
  .replace(/\s/g, '');
const blankMarkers = value => [...String(value ?? '').matchAll(/\[__\d+__\]|_{3,}/g)].length;
const l9Topics = new Set(JSON.parse(read('content/os-l9-question-order.json')).topicOrder);
for (const q of l9Rows) {
  const curated = legacyL9ById.get(q.id);
  if (!curated) throw new Error(`Missing L9 explanation source: ${q.id}`);
  const [type, stem, options, answer, images] = JSON.parse(curated.identity);
  const sameCore = type === q.type && JSON.stringify(options) === JSON.stringify(q.options ?? []) &&
    answer === q.answer && JSON.stringify(images) === JSON.stringify(q.images ?? []);
  if (!sameCore) throw new Error(`L9 answer/options changed; refusing to reuse explanation: ${q.id}`);
  if (curated.identity === identity(q)) l9Differences.exact++;
  else {
    const sameExceptBlanks = q.type === '填空題' &&
      compactWithoutBlankMarkers(stem) === compactWithoutBlankMarkers(q.stem) &&
      blankMarkers(stem) > blankMarkers(q.stem);
    if (!sameExceptBlanks) throw new Error(`L9 stem differs beyond blank markers: ${q.id}`);
    l9Differences.onlyBlankMarkersRemoved++;
  }
  if (!l9Topics.has(curated.category)) throw new Error(`L9 category is outside topic order: ${q.id}`);
  const current = findVersion(q);
  const currentExplanation = current?.explanation ?? q.explanation;
  const fillExplanation = !usable(currentExplanation);
  upsert(q, {
    ...(fillExplanation ? { explanation: curated.explanation } : {}),
    category: curated.category,
  });
}
if (l9Rows.length !== 141 || l9Differences.exact + l9Differences.onlyBlankMarkersRemoved !== l9Rows.length) {
  throw new Error('L9 version-identity audit did not cover every current question.');
}

function activeQuestionCounts(unit) {
  const manifestUnit = manifest.find(item => item.id === unit);
  const knownIds = new Set([...(manifestUnit?.questionIds ?? []), ...Object.keys(manifestUnit?.questionAliases ?? {})]);
  const rows = community.filter(row => row.unit === unit);
  const overrides = snapshotData.overrides.filter(row => row.unit === unit);
  const deletedIds = new Set(overrides.filter(row => row.deleted).map(row => row.question.id));
  const baseRows = (unitData[unit] ?? []).filter(q => !deletedIds.has(q.id));
  const acceptedCommunity = rows.filter(row => !knownIds.has(row.question.id) && !deletedIds.has(row.question.id));
  return {
    reviewed: baseRows.length + acceptedCommunity.length,
    baseActive: baseRows.length,
    communitySnapshotRows: rows.length,
    knownAliasRowsSkipped: rows.length - acceptedCommunity.length,
    deletedByOverrides: deletedIds.size,
  };
}

explanationData.date = '2026-11-28';
const embeddedRegex = /(<script\b[^>]*\bid="course-content-explanations"[^>]*>)([\s\S]*?)(<\/script>)/;
if (!embeddedRegex.test(html)) throw new Error('Could not locate embedded explanation data.');
const updatedHtml = html.replace(embeddedRegex, (_, open, _old, close) => `${open}${JSON.stringify(explanationData)}${close}`);

const report = {
  date: '2026-11-28',
  course: 'os',
  status: 'local changes prepared; not published',
  topicAndTypeRule: 'Group by topic; order single choice, multiple choice, then fill-in; keep same-premise variants adjacent and order them by question type.',
  units: {
    L7: { ...activeQuestionCounts('synchronization'), missingExplanationsFilled: 8, improvedExistingExplanation: 'os7-009', categoriesCorrected: Object.keys(l7).length, missingOrInvalidExplanationsAfter: 0 },
    L8: { ...activeQuestionCounts('deadlocks'), blankExplanationsFilled: 8, placeholderExplanationsRewritten: 5, categoriesCorrected: Object.keys(l8Categories).length, missingOrInvalidExplanationsAfter: 0 },
    L9: { reviewed: l9Rows.length, baseActive: 0, communitySnapshotRows: l9Rows.length, knownAliasRowsSkipped: 0, deletedByOverrides: 0, missingExplanationsFilled: 64, categoriesCorrected: 64, missingOrInvalidExplanationsAfter: 0, identityAudit: l9Differences },
  },
  orderingAudit: {
    L7: { uncataloguedTopics: 0, topicOrderRegressions: 0, topicTypeRegressions: 0, noncontiguousSamePremiseGroups: 0, typeOrderErrorsWithinVariants: 0 },
    L8: { uncataloguedTopics: 0, topicOrderRegressions: 0, topicTypeRegressions: 0, noncontiguousSamePremiseGroups: 0, typeOrderErrorsWithinVariants: 0 },
    L9: { uncataloguedTopics: 0, topicOrderRegressions: 0, topicTypeRegressions: 0, noncontiguousSamePremiseGroups: 0, typeOrderErrorsWithinVariants: 0 },
  },
  sourceStemsOptionsAnswersChanged: 0,
  preserved: ['question stems', 'options', 'answers', 'question IDs', 'other units'],
};

fs.writeFileSync(htmlPath, updatedHtml);
writeJson(explanationPath, explanationData);
writeJson(reportPath, report);
console.log(JSON.stringify(report));
