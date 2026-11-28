import {setupVisitorAccess} from './visitor-access.mjs?v=device-info-20261127';
import {setupEditModeration} from './edit-moderation.mjs?v=public-edit-rollback-20261120';
import {setupAdminSecurity} from './admin-security.mjs?v=security-20261118';
import {setupSystemPanel,usageBannerText} from './system-backup.mjs?v=traffic-protection-20261127';
import {setupUnitManager} from './unit-manager.mjs?v=unit-english-20261127';
import {setupLibraryHealth} from './library-health.mjs?v=admin-workspace-20261128';
import { api, message, downloadJSON } from './contributions-ui.js?v=treasure-unit-20261030';
import { setupLibraryManager } from './library-manager.mjs?v=admin-workspace-20261128';
import { setupImportRecords } from './import-records.mjs?v=management-workflow-20261125';

const $ = id => document.getElementById(id);
const origin = window.courseContributions.apiOrigin;
let library = null, health = null, units = null, system = null, security = null;
let imports = null, moderation = null, visitorAccess = null;
let userId = '';
const requestedSecurity=new URLSearchParams(location.search).get('view')==='security';
let currentView = requestedSecurity?'security':'all';
let starting = false;
let lastQuestionView = 'all';
const questionViews = new Set(['all','pending','modified','deleted']);

function setActiveView(view) {
  if (library?.closeEditor() === false) return false;
  currentView = view;
  const browsingQuestions = questionViews.has(view);
  const needsAttention = view === 'health' || view === 'pending';
  const section = browsingQuestions || view === 'health' ? 'questions' : ['system','security','moderation'].includes(view) ? 'settings' : view;
  const headings = {
    questions:['題目管理','先選科目與單元，再搜尋或點選題目編輯。'],
    imports:['匯入紀錄','按匯入批次查看題目與處理結果。'],
    units:['課程與單元','調整單元名稱、英文副標題與顯示順序。'],
    visitors:['訪客與封鎖','查看訪客，管理瀏覽器與 IP 的存取。'],
    settings:['系統設定','管理備份、用量、修改防護與帳號安全。'],
  };
  const [title,hint] = headings[section] || headings.questions;
  $('managementViewTitle').textContent=title;
  $('managementViewHint').textContent=hint;
  if (browsingQuestions) {
    lastQuestionView = view;
    if (userId) try { localStorage.setItem('course-library.manager-view.v1.' + userId, view); } catch {}
  }
  for (const button of document.querySelectorAll('[data-view]')) {
    const selected = button.dataset.section ? button.dataset.section === section : button.closest('#managementNav') && button.dataset.view === 'health' ? needsAttention : button.dataset.view === view;
    button.setAttribute('aria-current', selected ? 'page' : 'false');
  }
  for (const id of ['managementSearch', 'libraryWorkspace']) $(id).hidden = !browsingQuestions;
  $('managementNav').hidden = section !== 'questions';
  $('managementTaskNav').hidden = !needsAttention;
  $('managementSettingsNav').hidden = section !== 'settings';
  $('managementDownloads').hidden = section !== 'settings';
  $('returnToQuestions').hidden = true;
  $('managementSearch').closest('.management-toolbar').hidden = !['questions','settings'].includes(section);
  $('systemWorkspace').hidden = view !== 'system';
  $('securityWorkspace').hidden = view !== 'security';
  $('moderationWorkspace').hidden = view !== 'moderation';
  if (view !== 'moderation') moderation?.clear();
  $('visitorWorkspace').hidden = view !== 'visitors';
  if (view !== 'visitors') visitorAccess?.clear();
  if(view!=='security')security?.clear();
  $('unitWorkspace').hidden = view !== 'units';
  $('healthWorkspace').hidden = view !== 'health';
  $('importWorkspace').hidden = view !== 'imports';
  return true;
}
async function showView(view = currentView, { refresh = false } = {}) {
  if (!library || !imports) return;
  if (!setActiveView(view)) return;
  if(view==='security')await security.show();
  else if(view==='moderation')await moderation.show();
  else if(view==='visitors')await visitorAccess.show();
  else if(view==='system')await system.show();
  else if(view==='units') await units.show({refresh});
  else if(view==='health') await health.show({refresh,course:$('libraryCourse')?.value,unit:$('libraryUnit')?.value});
  else if (view === 'imports') await imports.show({ refresh });
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
  $('credentialAccess').hidden = !session.canManageCredentials;
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
      health?.clear();units?.clear();system?.clear();security?.clear();moderation?.clear();visitorAccess?.clear();
      library?.clear();
      imports?.clear();
      userId = session.userId || 'owner';
      lastQuestionView = 'all';
      try {
        const saved = localStorage.getItem('course-library.manager-view.v1.' + userId);
        if (questionViews.has(saved)) lastQuestionView = saved;
      } catch {}
      if (!requestedSecurity) currentView = 'all';
      library = setupLibraryManager({
        userId,
        onChanged: () => { health?.invalidate();if (currentView==='health')return health.show({refresh:true});if (imports && currentView === 'imports') return imports.show({ refresh: true }); },
      });
      units=setupUnitManager({container:$('unitWorkspace'),onChanged:()=>{library.refresh();health?.invalidate();}});
      security=setupAdminSecurity({container:$('securityWorkspace'),api,message,downloadJSON});
      visitorAccess=setupVisitorAccess({container:$('visitorWorkspace'),api});
      moderation=setupEditModeration({container:$('moderationWorkspace'),api,onChanged:()=>{void library.refresh();health?.invalidate();}});
      system=setupSystemPanel({container:$('systemWorkspace'),api,downloadJSON,userId});
      health=setupLibraryHealth({container:$('healthWorkspace'),openItem:(row,options)=>library.openItem(row,options)});
      imports = setupImportRecords({
        userId,
        onChanged: () => library?.refresh(),
      });
    }
    await showView(currentView);
    // One owner-only check after login; no visitor polling or extra database counter writes.
    void api('/api/manage/traffic').then(data=>{const notice=$('trafficNotice');if(notice){notice.textContent=usageBannerText(data);notice.hidden=!notice.textContent;}}).catch(()=>{const notice=$('trafficNotice');if(notice){notice.textContent='暫時無法檢查官方用量，請至「版本、流量與用量」重新檢查。';notice.hidden=false;}});
    if(['imports','health','units','system','security','moderation','visitors'].includes(currentView))void library.refresh();
  } catch (error) {
    $('authStatus').hidden = false;
    $('authStatus').textContent = '無法連線管理服務。請重新整理再試。';
    $('loginPanel').hidden = true;
    message(error.message, true);
  } finally {
    starting = false;
  }
}
$('managementTabs').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button || !library || !imports) return;
  showView(button.dataset.view);
});
$('returnToQuestions').addEventListener('click', async () => {
  await showView(lastQuestionView);
  if (questionViews.has(currentView)) $('managementNav').querySelector('[aria-current=page]')?.focus();
});
$('passwordLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = $('loginSubmit');
  submit.disabled = true;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({
      username: $('loginUsername').value,
      password: $('loginPassword').value,
      code: $('loginCode').value,
    }) });
    $('loginPassword').value = '';
    $('loginCode').value = '';
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
    await showView('system');
    message('請在此建立含實際題圖的完整備份，或檢查已有備份。');
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
    health?.clear();units?.clear();system?.clear();security?.clear();moderation?.clear();visitorAccess?.clear();
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
