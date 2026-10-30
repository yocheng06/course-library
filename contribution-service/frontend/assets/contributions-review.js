import { api, message, downloadJSON } from './contributions-ui.js?v=treasure-unit-20261030';
import { setupLibraryManager } from './library-manager.mjs?v=treasure-unit-20261030';
import { setupImportRecords } from './import-records.mjs?v=treasure-unit-20261030';

const $ = id => document.getElementById(id);
const origin = window.courseContributions.apiOrigin;
let library = null;
let imports = null;
let userId = '';
let currentView = 'modified';
let starting = false;

function setActiveView(view) {
  currentView = view;
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false');
  }
  $('libraryWorkspace').hidden = view === 'imports';
  $('importWorkspace').hidden = view !== 'imports';
}
async function showView(view = currentView, { refresh = false } = {}) {
  if (!library || !imports) return;
  setActiveView(view);
  if (view === 'imports') await imports.show({ refresh });
  else await library.show(view, { refresh });
}
function showLogin(session) {
  $('managementArea').hidden = true;
  $('authStatus').hidden = true;
  $('loginPanel').hidden = false;
  const resetRequested = new URLSearchParams(location.search).get('credentials') === 'reset';
  const canSetUp = session.canUseSetupCode ||
    (session.canManageCredentials && (!session.accountConfigured || resetRequested));
  $('passwordLoginForm').hidden = !session.accountConfigured || canSetUp;
  $('passwordSetupForm').hidden = !canSetUp;
  $('setupCodeField').hidden = !session.canUseSetupCode;
  $('setupCode').required = session.canUseSetupCode;
  $('credentialAccess').hidden = session.canUseSetupCode ||
    (session.canManageCredentials && canSetUp);
  if (session.canUseSetupCode) {
    $('loginTitle').textContent = session.accountConfigured ? '設定或重設管理者帳號' : '首次設定管理者帳號';
    $('loginHint').textContent = '輸入一次性設定碼並設定帳號密碼；設定碼使用後就會失效。之後登入只需帳號密碼。';
  } else if (canSetUp && session.canManageCredentials) {
    $('loginTitle').textContent = session.accountConfigured ? '重設管理者帳號' : '首次設定管理者帳號';
    $('loginHint').textContent = session.accountConfigured
      ? '已用綁定帳號驗證身份。可設定新的登入帳號與密碼。'
      : '已用綁定帳號驗證身份。設定帳號與密碼後即可登入管理。';
  } else {
    $('loginTitle').textContent = '管理者登入';
    $('loginHint').textContent = session.accountConfigured
      ? '輸入已設定的帳號與密碼即可管理題庫。'
      : '首次設定管理者帳號需要先以綁定的管理者帳號驗證。';
    $('credentialAccess').textContent = session.accountConfigured
      ? '忘記密碼？以綁定的管理者帳號驗證'
      : '以綁定的管理者帳號驗證並設定登入帳號';
  }
}
async function start() {
  if (starting) return;
  starting = true;
  $('authStatus').hidden = false;
  $('authStatus').textContent = '正在確認管理者身份…';
  $('loginPanel').hidden = true;
  try {
    const session = await api('/api/session');
    if (!session.isReviewer) {
      showLogin(session);
      return;
    }
    $('authStatus').hidden = true;
    $('loginPanel').hidden = true;
    $('managementArea').hidden = false;
    if (userId !== session.userId || !library || !imports) {
      library?.clear();
      imports?.clear();
      userId = session.userId || 'owner';
      library = setupLibraryManager({
        userId,
        onChanged: () => { if (imports && currentView === 'imports') return imports.show({ refresh: true }); },
      });
      imports = setupImportRecords({
        userId,
        onChanged: () => library?.refresh(),
      });
    }
    await showView(currentView);
  } catch (error) {
    $('authStatus').hidden = false;
    $('authStatus').textContent = '無法連線管理服務。請重新整理再試。';
    $('loginPanel').hidden = true;
    message(error.message, true);
  } finally {
    starting = false;
  }
}
$('managementNav').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button || !library || !imports) return;
  showView(button.dataset.view);
});
$('passwordLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = $('loginSubmit');
  submit.disabled = true;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({
      username: $('loginUsername').value,
      password: $('loginPassword').value,
    }) });
    $('loginPassword').value = '';
    message('');
    await start();
  } catch (error) { message(error.message, true); }
  finally { submit.disabled = false; }
});
$('passwordSetupForm').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = $('setupSubmit');
  submit.disabled = true;
  try {
    await api('/api/password/setup', { method: 'POST', body: JSON.stringify({
      username: $('setupUsername').value,
      password: $('setupPassword').value,
      confirmPassword: $('setupPasswordConfirm').value,
      setupCode: $('setupCode').value,
    }) });
    $('setupCode').value = '';
    $('setupPassword').value = '';
    $('setupPasswordConfirm').value = '';
    message('');
    await start();
  } catch (error) { message(error.message, true); }
  finally { submit.disabled = false; }
});
$('exportQuestionDrafts').addEventListener('click', () => library?.exportDrafts());
$('exportImportDrafts').addEventListener('click', () => imports?.exportDrafts());
$('exportBackup').addEventListener('click', async () => {
  const button = $('exportBackup');
  button.disabled = true;
  try {
    const result = await api('/api/manage/export');
    downloadJSON(result, '課程題庫完整備份.json');
    message('已下載完整備份。題圖仍以連結保存。');
  } catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});
$('signOut').addEventListener('click', async () => {
  const button = $('signOut');
  button.disabled = true;
  try {
    await api('/api/logout', { method: 'POST', body: '{}' });
    library?.clear();
    imports?.clear();
    location.reload();
  } catch (error) { message(error.message, true); button.disabled = false; }
});
if (location.origin !== origin) {
  location.replace(origin + '/review');
} else {
  $('loginSubmit').disabled = false;
  $('setupSubmit').disabled = false;
  start();
}
