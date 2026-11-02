const categories = [...document.querySelectorAll('.category')];
const sections = [...document.querySelectorAll('.settings-section')];
const switches = [...document.querySelectorAll('input[type="checkbox"]')];
const search = document.getElementById('settings-search');
const activeFilter = document.getElementById('active-filter');
const status = document.getElementById('status');
let selectedSection = 'section-0';
let enabledOnly = false;

function renderSettings() {
  const query = search.value.trim().toLowerCase();
  let visibleCount = 0;
  const enabledCount = switches.filter(input => input.checked).length;
  document.getElementById('enabled-count').textContent = enabledCount;
  categories.forEach(button => {
    button.setAttribute('aria-current', String(button.dataset.section === selectedSection && !query && !enabledOnly));
    const section = document.getElementById(button.dataset.section);
    button.querySelector('.category-count').textContent = section.querySelectorAll('input:checked').length || '';
  });
  sections.forEach(section => {
    let sectionCount = 0;
    section.querySelectorAll('.checkbox-container').forEach(card => {
      const matches = (!query || `${section.dataset.name} ${card.textContent}`.toLowerCase().includes(query)) &&
        (!enabledOnly || card.querySelector('input:checked') || (card.querySelector('select')?.value !== 'auto' && card.querySelector('select')));
      const visible = Boolean(matches && (query || enabledOnly || section.id === selectedSection));
      card.hidden = !visible;
      if (visible) sectionCount++;
    });
    section.hidden = sectionCount === 0;
    visibleCount += sectionCount;
  });
  document.getElementById('empty-state').hidden = visibleCount > 0;
  document.getElementById('page-title').textContent = query ? 'Search results' : enabledOnly ? 'Enabled settings' : document.getElementById(selectedSection).dataset.name;
}

async function sendAction(action, content) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id || !/^https?:\/\/(www|m)\.youtube\.com\//.test(tab.url ?? '')) {
    throw new Error('Open a YouTube tab to apply these settings.');
  }
  await chrome.tabs.sendMessage(tab.id, {action, ...(content === undefined ? {} : {content})});
}
function showError(error) { status.textContent = error.message || 'Unable to apply settings. Reload YouTube and try again.'; }
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById('theme-toggle');
  button.textContent = theme === 'dark' ? '☀  Light mode' : '☾  Dark mode';
  button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
}

categories.forEach(button => button.addEventListener('click', () => {
  selectedSection = button.dataset.section;
  search.value = '';
  enabledOnly = false;
  activeFilter.setAttribute('aria-pressed', 'false');
  renderSettings();
  document.querySelector('.settings-scroll').scrollTop = 0;
}));
search.addEventListener('input', renderSettings);
activeFilter.addEventListener('click', () => {
  enabledOnly = !enabledOnly;
  activeFilter.setAttribute('aria-pressed', String(enabledOnly));
  renderSettings();
});
document.getElementById('theme-toggle').addEventListener('click', async () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try { await chrome.storage.local.set({tubemod_theme: theme}); } catch (error) { showError(error); }
});
switches.forEach(input => input.addEventListener('change', async () => {
  try {
    await sendAction({target: input.id, hide: input.checked});
    status.textContent = 'Setting applied · Saved automatically';
  } catch (error) { input.checked = !input.checked; showError(error); }
  renderSettings();
}));
const videoColumns = document.getElementById('video-columns');
videoColumns.addEventListener('change', async () => {
  try {
    await chrome.storage.local.set({tubemod_video_columns: videoColumns.value === 'auto' ? 'auto' : Number(videoColumns.value)});
    status.textContent = 'Grid preference saved';
  } catch (error) { showError(error); }
  renderSettings();
});
document.getElementById('save-settings').addEventListener('click', async () => {
  try { await sendAction('saveSettings'); status.textContent = 'Settings exported'; } catch (error) { showError(error); }
});
document.getElementById('reset-settings').addEventListener('click', async () => {
  try {
    await sendAction('clearLocalStorage');
    switches.forEach(input => { input.checked = false; });
    videoColumns.value = 'auto';
    renderSettings();
    status.textContent = 'Default settings restored';
  } catch (error) { showError(error); }
});
const fileInput = document.getElementById('import-settings');
document.getElementById('import-trigger').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (typeof data.tubemod_elements !== 'string' || !Array.isArray(JSON.parse(data.tubemod_elements))) throw new Error('Choose a valid TubeMod settings export.');
    await sendAction('importSettings', text);
    JSON.parse(data.tubemod_elements).forEach(element => {
      const input = switches.find(input => input.id === element.id);
      if (input) input.checked = Boolean(element.checked);
    });
    videoColumns.value = [3,4,5,6].includes(data.tubemod_video_columns) ? String(data.tubemod_video_columns) : 'auto';
    renderSettings();
    status.textContent = 'Settings imported';
  } catch (error) { showError(error); }
  fileInput.value = '';
});
async function initialize() {
  try {
    const data = await chrome.storage.local.get(['tubemod_elements','tubemod_video_columns','tubemod_theme']);
    setTheme(data.tubemod_theme === 'light' ? 'light' : 'dark');
    const stored = data.tubemod_elements ? JSON.parse(data.tubemod_elements) : [];
    stored.forEach(element => {
      const input = switches.find(input => input.id === element.id);
      if (input) input.checked = Boolean(element.checked);
    });
    videoColumns.value = [3,4,5,6].includes(data.tubemod_video_columns) ? String(data.tubemod_video_columns) : 'auto';
  } catch (error) { showError(error); }
  renderSettings();
}
renderSettings();
initialize();
