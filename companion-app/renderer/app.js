// ── State ─────────────────────────────────────────────────────
const state = {
  authToken: null, appUrl: 'https://eventsnap-final-deploy.vercel.app',
  events: [], eventId: null, eventName: null, eventSlug: null,
  folderPath: null, mode: 'auto', manualFiles: [],
  uploaded: 0, failed: 0, queueCount: 0, totalSession: 0,
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function setError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg || ''; }
function addLog(msg, type = 'info') {
  const log = document.getElementById('upload-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
  entry.textContent = `${time}  ${msg}`;
  log.insertBefore(entry, log.firstChild);
  while (log.children.length > 80) log.removeChild(log.lastChild);
}
function updateStats() {
  document.getElementById('s-uploaded').textContent = state.uploaded;
  document.getElementById('s-queue').textContent    = state.queueCount;
  document.getElementById('s-failed').textContent   = state.failed;
  if (state.totalSession > 0) {
    const pct = Math.round((state.uploaded / state.totalSession) * 100);
    document.getElementById('live-progress').style.width = pct + '%';
  }
}
function fmtSize(bytes) {
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

// ── Login ─────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('inp-email').value.trim();
  const password = document.getElementById('inp-password').value;
  const appUrl = document.getElementById('inp-appurl').value.trim() || state.appUrl;
  setError('login-error', '');
  if (!email || !password) { setError('login-error', 'Please enter your email and password.'); return; }
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const SUPA_URL = 'https://cwmedddisuswnkvcteja.supabase.co';
    const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bWVkZGRpc3Vzd25rdmN0ZWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzUwNzQsImV4cCI6MjA5MjExMTA3NH0.y2jEhJuGg4Zl-Q6SsaRznNT2DxPp7ZaL_RmdkR9cnwQ';
    const authRes = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
      body: JSON.stringify({ email, password }),
    });
    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(authData.error_description || 'Login failed');
    state.authToken = authData.access_token;
    state.appUrl = appUrl;
    await window.api.setAuth({ authToken: state.authToken, appUrl: state.appUrl });
    const evRes = await fetch(`${appUrl}/api/photographer/events`, {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });
    const events = await evRes.json();
    state.events = Array.isArray(events) ? events : [];
    const sel = document.getElementById('sel-event');
    sel.innerHTML = '<option value="">— Choose an event —</option>';
    state.events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.id; opt.textContent = ev.name;
      sel.appendChild(opt);
    });
    showScreen('screen-setup');
  } catch (err) {
    setError('login-error', err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In →';
  }
});

['inp-email', 'inp-password', 'inp-appurl'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
});

// ── Setup screen ──────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  state.authToken = null; state.events = [];
  showScreen('screen-login');
});
document.getElementById('sel-event').addEventListener('change', (e) => {
  const ev = state.events.find(x => x.id === e.target.value);
  state.eventId = ev?.id || null;
  state.eventName = ev?.name || null;
  state.eventSlug = ev?.slug || null;
  refreshSetupButtons();
});
function refreshSetupButtons() {
  document.getElementById('btn-start-watch').disabled = !(state.eventId && state.folderPath);
  document.getElementById('btn-upload-manual').disabled = !(state.eventId && state.manualFiles.length > 0);
}
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    state.mode = tab.dataset.tab;
  });
});
document.getElementById('folder-zone').addEventListener('click', async () => {
  const folder = await window.api.selectFolder();
  if (folder) {
    state.folderPath = folder;
    const display = document.getElementById('folder-path-display');
    display.textContent = folder; display.style.display = 'block';
    refreshSetupButtons();
  }
});
document.getElementById('btn-start-watch').addEventListener('click', async () => {
  if (!state.eventId || !state.folderPath) return;
  const result = await window.api.startWatching({ folderPath: state.folderPath, eventId: state.eventId });
  if (result.success) enterLiveScreen('auto');
});
document.getElementById('drop-zone').addEventListener('click', async () => {
  const files = await window.api.selectFiles();
  if (files.length > 0) addManualFiles(files);
});
document.getElementById('drop-zone').addEventListener('dragover', (e) => {
  e.preventDefault(); document.getElementById('drop-zone').classList.add('dragover');
});
document.getElementById('drop-zone').addEventListener('dragleave', () => {
  document.getElementById('drop-zone').classList.remove('dragover');
});
document.getElementById('drop-zone').addEventListener('drop', async (e) => {
  e.preventDefault(); document.getElementById('drop-zone').classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files)
    .filter(f => /\.(jpg|jpeg|png|heic|heif|cr2|cr3|nef|arw|orf|rw2)$/i.test(f.name))
    .map(f => ({ path: f.path, name: f.name, size: f.size }));
  if (files.length > 0) addManualFiles(files);
});
function addManualFiles(newFiles) {
  const existing = new Set(state.manualFiles.map(f => f.path));
  state.manualFiles.push(...newFiles.filter(f => !existing.has(f.path)));
  renderManualFileList(); refreshSetupButtons();
}
function renderManualFileList() {
  const container = document.getElementById('manual-file-list');
  if (state.manualFiles.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'flex'; container.innerHTML = '';
  state.manualFiles.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<div class="file-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;">🖼️</div><div class="file-info"><div class="file-name">${f.name}</div><div class="file-size">${fmtSize(f.size)}</div></div><button class="file-remove" data-idx="${i}">✕</button>`;
    container.appendChild(item);
  });
  container.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.manualFiles.splice(parseInt(btn.dataset.idx), 1);
      renderManualFileList(); refreshSetupButtons();
    });
  });
}
document.getElementById('btn-upload-manual').addEventListener('click', async () => {
  if (!state.eventId || state.manualFiles.length === 0) return;
  state.totalSession = state.manualFiles.length;
  await window.api.uploadFiles({ files: state.manualFiles, eventId: state.eventId });
  enterLiveScreen('manual');
  state.manualFiles = []; renderManualFileList();
});

// ── Live screen ───────────────────────────────────────────────
function enterLiveScreen(mode) {
  state.uploaded = 0; state.failed = 0; state.queueCount = 0;
  const badge = document.getElementById('live-mode-badge');
  const statusText = document.getElementById('live-status-text');
  if (mode === 'auto') {
    badge.className = 'badge badge-active'; badge.textContent = '● Auto';
    statusText.textContent = 'Auto-uploading — watching camera folder';
  } else {
    badge.className = 'badge badge-violet'; badge.textContent = '⬆ Manual';
    statusText.textContent = 'Uploading selected photos...';
  }
  document.getElementById('live-event-name').textContent = state.eventName || '';
  document.getElementById('live-event-slug').textContent = '/event/' + (state.eventSlug || '');
  document.getElementById('extra-manual-section').style.display = mode === 'auto' ? 'block' : 'none';
  document.getElementById('upload-log').innerHTML = '';
  updateStats(); showScreen('screen-live');
}
document.getElementById('btn-stop-live').addEventListener('click', async () => {
  await window.api.stopWatching(); showScreen('screen-setup');
});
document.getElementById('btn-add-more').addEventListener('click', async () => {
  const files = await window.api.selectFiles();
  if (files.length > 0 && state.eventId) {
    state.totalSession += files.length;
    await window.api.uploadFiles({ files, eventId: state.eventId });
    addLog(`📂 Added ${files.length} file(s) to queue`, 'info'); updateStats();
  }
});

// ── IPC events ────────────────────────────────────────────────
window.api.on('file-detected', ({ name }) => { state.queueCount++; state.totalSession++; addLog(`📸 Detected: ${name}`, 'info'); updateStats(); });
window.api.on('upload-start', ({ name, queueRemaining }) => { state.queueCount = queueRemaining; addLog(`⬆  Uploading: ${name}`, 'upload'); updateStats(); });
window.api.on('upload-success', ({ name, queueRemaining }) => { state.uploaded++; state.queueCount = queueRemaining; addLog(`✓  Done: ${name}`, 'success'); updateStats(); });
window.api.on('upload-retry', ({ name, attempt }) => { addLog(`↻  Retry ${attempt}/3: ${name}`, 'warning'); });
window.api.on('upload-failed', ({ name, error, queueRemaining }) => { state.failed++; state.queueCount = queueRemaining; addLog(`✗  Failed: ${name} — ${error}`, 'error'); updateStats(); });
window.api.on('watch-error', ({ error }) => { addLog(`⚠  Watch error: ${error}`, 'error'); });
