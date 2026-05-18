const {
  app, BrowserWindow, ipcMain,
  dialog, Tray, Menu, nativeImage
} = require('electron');
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');
const fs = require('fs');
let FtpSrv = null; // lazy-required so the app still launches if dep is missing

let mainWindow = null;
let tray = null;
let currentWatcher = null;
let ftpServer = null;
let ftpRoot = null;
const uploadQueue = [];
let isUploading = false;
const uploadedFiles = new Set();
const SIGNED_URL_BATCH_SIZE = 100;
const STORAGE_UPLOAD_CONCURRENCY = 8;

// Global state set by renderer
global.authToken = null;
global.currentEventId = null;
global.appUrl = 'https://eventsnap-final-deploy.vercel.app';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 680,
    minWidth: 440,
    minHeight: 680,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0D0A14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
  });
  mainWindow.loadFile('renderer/index.html');
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  let icon;
  try {
    icon = nativeImage.createFromPath(
      path.join(__dirname, 'assets/tray-icon.png')
    ).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Open EventSnap Companion', click: () => mainWindow.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); }
    },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip('EventSnap Companion');
  tray.on('double-click', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});
app.on('window-all-closed', (e) => e.preventDefault());
app.on('activate', () => mainWindow.show());

// ── IPC: Auth ─────────────────────────────────────────────────
ipcMain.handle('set-auth', (_, { authToken, appUrl }) => {
  global.authToken = authToken;
  if (appUrl) global.appUrl = appUrl;
  return { success: true };
});

// ── IPC: Select folder ────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Camera Folder or Memory Card (DCIM)',
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: Select files (manual) ────────────────────────────────
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'Select Photos to Upload',
    filters: [
      {
        name: 'Images',
        extensions: [
          'jpg','jpeg','png','heic','heif',
          'cr2','cr3','nef','arw','orf','rw2'
        ]
      }
    ],
  });
  if (result.canceled) return [];
  return result.filePaths.map(fp => ({
    path: fp,
    name: path.basename(fp),
    size: fs.statSync(fp).size,
  }));
});

// ── IPC: Start auto-watch ─────────────────────────────────────
ipcMain.handle('start-watching', async (_, { folderPath, eventId }) => {
  if (currentWatcher) {
    await currentWatcher.close();
    currentWatcher = null;
  }
  global.currentEventId = eventId;
  uploadedFiles.clear();

  const IMAGE_EXT = /\.(jpg|jpeg|png|heic|heif|cr2|cr3|nef|arw|orf|rw2)$/i;

  currentWatcher = chokidar.watch(folderPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
    depth: 3,
  });

  currentWatcher.on('add', (filePath) => {
    if (IMAGE_EXT.test(filePath) && !uploadedFiles.has(filePath)) {
      uploadedFiles.add(filePath);
      const name = path.basename(filePath);
      const size = fs.statSync(filePath).size;
      enqueueUpload({ filePath, name, size, eventId, source: 'auto' });
      mainWindow.webContents.send('file-detected', { name, path: filePath });
    }
  });

  currentWatcher.on('error', (err) => {
    mainWindow.webContents.send('watch-error', { error: err.message });
  });

  return { success: true };
});

// ── IPC: Stop auto-watch ──────────────────────────────────────
ipcMain.handle('stop-watching', async () => {
  if (currentWatcher) {
    await currentWatcher.close();
    currentWatcher = null;
  }
  return { success: true };
});

// ── IPC: Embedded FTP server ──────────────────────────────────
// Lets a tethered camera (or any FTP-capable device) push images
// directly to the laptop. Files land in a temp directory and are
// fed straight into the same upload queue as the folder watcher.
//
// Most modern Sony/Canon/Fuji cameras support FTP push; configure
// the camera to:
//   Server  : <this laptop's LAN IP>
//   Port    : the port returned here (default 2121)
//   User    : eventsnap     (or anonymous, depending on options)
//   Password: <whatever the user sets, blank = anonymous allowed>
ipcMain.handle('start-ftp-server', async (_, opts = {}) => {
  if (ftpServer) {
    return { success: true, alreadyRunning: true, port: ftpServer._port, root: ftpRoot };
  }
  if (!FtpSrv) {
    try { FtpSrv = require('ftp-srv'); }
    catch (e) {
      return { success: false, error: 'ftp-srv module not installed. Run: npm install in companion-app/' };
    }
  }

  const port = Number(opts.port || 2121);
  const eventId = opts.eventId || global.currentEventId;
  if (!eventId) {
    return { success: false, error: 'Pick an event before starting the FTP server.' };
  }
  global.currentEventId = eventId;

  const username = opts.username || 'eventsnap';
  const password = opts.password || '';     // empty string = anonymous OK
  const allowAnonymous = !password;

  ftpRoot = path.join(os.tmpdir(), `eventsnap-ftp-${Date.now()}`);
  fs.mkdirSync(ftpRoot, { recursive: true });

  const server = new FtpSrv({
    url: `ftp://0.0.0.0:${port}`,
    anonymous: allowAnonymous,
    pasv_url: opts.pasvUrl || '127.0.0.1',
    pasv_min: Number(opts.pasvMin || 50000),
    pasv_max: Number(opts.pasvMax || 50100),
    greeting: ['EventSnap Companion FTP'],
  });

  server.on('login', ({ username: u, password: p }, resolve, reject) => {
    if (allowAnonymous && (u === 'anonymous' || u === username)) return resolve({ root: ftpRoot });
    if (u === username && p === password) return resolve({ root: ftpRoot });
    return reject(new Error('Invalid credentials'));
  });

  // chokidar over the FTP root so completed PUTs are picked up the
  // same way as the folder watcher — single code path downstream.
  const ftpWatcher = chokidar.watch(ftpRoot, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 300 },
    depth: 5,
  });
  const IMAGE_EXT = /\.(jpg|jpeg|png|heic|heif|cr2|cr3|nef|arw|orf|rw2)$/i;
  ftpWatcher.on('add', (filePath) => {
    if (!IMAGE_EXT.test(filePath)) return;
    if (uploadedFiles.has(filePath)) return;
    uploadedFiles.add(filePath);
    let size = 0;
    try { size = fs.statSync(filePath).size; } catch (_) {}
    enqueueUpload({
      filePath,
      name: path.basename(filePath),
      size,
      eventId: global.currentEventId,
      source: 'ftp',
      cleanupAfterUpload: true, // tmp file — delete after successful upload
    });
    if (mainWindow) mainWindow.webContents.send('file-detected', { name: path.basename(filePath), path: filePath, source: 'ftp' });
  });

  try {
    await server.listen();
    server._port = port;
    server._watcher = ftpWatcher;
    ftpServer = server;
    if (mainWindow) mainWindow.webContents.send('ftp-started', { port, root: ftpRoot, anonymous: allowAnonymous });
    return { success: true, port, root: ftpRoot, anonymous: allowAnonymous };
  } catch (err) {
    try { await ftpWatcher.close(); } catch (_) {}
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-ftp-server', async () => {
  if (!ftpServer) return { success: true, alreadyStopped: true };
  try {
    if (ftpServer._watcher) await ftpServer._watcher.close();
    await ftpServer.close();
  } catch (_) {}
  ftpServer = null;
  // Best-effort cleanup of the temp root
  if (ftpRoot) {
    try { fs.rmSync(ftpRoot, { recursive: true, force: true }); } catch (_) {}
    ftpRoot = null;
  }
  if (mainWindow) mainWindow.webContents.send('ftp-stopped', {});
  return { success: true };
});

ipcMain.handle('get-ftp-status', () => ({
  running: !!ftpServer,
  port: ftpServer?._port || null,
  root: ftpRoot,
}));

// ── IPC: Manual upload ────────────────────────────────────────
ipcMain.handle('upload-files', (_, { files, eventId }) => {
  files.forEach(file => {
    enqueueUpload({
      filePath: file.path,
      name: file.name,
      size: file.size,
      eventId,
      source: 'manual',
    });
  });
  return { success: true, queued: files.length };
});

// ── IPC: Get queue status ─────────────────────────────────────
ipcMain.handle('get-queue-status', () => ({
  queued: uploadQueue.length,
  uploading: isUploading,
}));

// ── Upload Engine ─────────────────────────────────────────────
function enqueueUpload(item) {
  uploadQueue.push({ ...item, attempts: 0 });
  processQueue();
}

async function processQueueLegacy() {
  if (isUploading || uploadQueue.length === 0) return;
  isUploading = true;
  const item = uploadQueue.shift();

  mainWindow.webContents.send('upload-start', {
    name: item.name,
    source: item.source,
    queueRemaining: uploadQueue.length,
  });

  try {
    await uploadPhotoLegacy(item);
    mainWindow.webContents.send('upload-success', {
      name: item.name,
      source: item.source,
      queueRemaining: uploadQueue.length,
    });
  } catch (err) {
    if (item.attempts < 3) {
      item.attempts++;
      uploadQueue.unshift(item);
      mainWindow.webContents.send('upload-retry', {
        name: item.name,
        attempt: item.attempts,
      });
    } else {
      mainWindow.webContents.send('upload-failed', {
        name: item.name,
        error: err.message,
        queueRemaining: uploadQueue.length,
      });
    }
  }

  isUploading = false;
  if (uploadQueue.length > 0) setTimeout(processQueue, 300);
}

async function uploadPhotoLegacy({ filePath, name, size, eventId, source }) {
  const fetch = require('node-fetch');
  const ext = path.extname(name).toLowerCase().replace('.', '') || 'jpg';
  const mimeTypes = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    heic: 'image/heic', heif: 'image/heif',
    cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3',
    nef: 'image/x-nikon-nef', arw: 'image/x-sony-arw',
    orf: 'image/x-olympus-orf', rw2: 'image/x-panasonic-rw2',
  };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

  // Step 1: Get signed upload URL
  const urlRes = await fetch(`${global.appUrl}/api/photographer/get-upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${global.authToken}`,
    },
    body: JSON.stringify({
      eventId, filename: name,
      contentType: mimeType,
      fileSizeBytes: size,
    }),
  });

  if (!urlRes.ok) {
    const err = await urlRes.json();
    throw new Error(err.error || `HTTP ${urlRes.status}`);
  }

  const { signedUrl, storagePath, photoId } = await urlRes.json();

  // Step 2: Upload directly to Supabase Storage
  const fileBuffer = fs.readFileSync(filePath);
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`Storage upload failed: ${uploadRes.status}`);
  }

  // Step 3: Confirm upload → triggers processing pipeline
  const confirmRes = await fetch(`${global.appUrl}/api/photographer/confirm-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${global.authToken}`,
    },
    body: JSON.stringify({
      eventId, storagePath, photoId,
      originalFilename: name,
      fileSizeBytes: size,
      uploadSource: source,
    }),
  });

  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    throw new Error(err.error || 'Confirm failed');
  }
}

// Batched upload engine used by enqueueUpload.
async function processQueue() {
  if (isUploading || uploadQueue.length === 0) return;
  isUploading = true;

  try {
    const batch = uploadQueue.splice(0, SIGNED_URL_BATCH_SIZE);
    await uploadBatch(batch);
  } catch (err) {
    mainWindow.webContents.send('watch-error', { error: err.message });
  }

  isUploading = false;
  if (uploadQueue.length > 0) setTimeout(processQueue, 50);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

function getMimeType(name) {
  const ext = path.extname(name).toLowerCase().replace('.', '') || 'jpg';
  const mimeTypes = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    heic: 'image/heic', heif: 'image/heif',
    cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3',
    nef: 'image/x-nikon-nef', arw: 'image/x-sony-arw',
    orf: 'image/x-olympus-orf', rw2: 'image/x-panasonic-rw2',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

function failOrRetry(item, error) {
  if (item.attempts < 3) {
    item.attempts++;
    uploadQueue.unshift(item);
    mainWindow.webContents.send('upload-retry', {
      name: item.name,
      attempt: item.attempts,
    });
    return;
  }

  mainWindow.webContents.send('upload-failed', {
    name: item.name,
    error,
    queueRemaining: uploadQueue.length,
  });
}

async function uploadBatch(batch) {
  const fetch = require('node-fetch');
  const eventId = batch[0]?.eventId;
  if (!eventId) return;

  batch.forEach((item) => {
    mainWindow.webContents.send('upload-start', {
      name: item.name,
      source: item.source,
      queueRemaining: uploadQueue.length,
    });
  });

  const urlRes = await fetch(`${global.appUrl}/api/photographer/get-upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${global.authToken}`,
    },
    body: JSON.stringify({
      eventId,
      files: batch.map((item) => ({
        filename: item.name,
        contentType: getMimeType(item.name),
        fileSizeBytes: item.size,
      })),
    }),
  });

  if (!urlRes.ok) {
    const err = await urlRes.json();
    batch.forEach((item) => failOrRetry(item, err.error || `HTTP ${urlRes.status}`));
    return;
  }

  const { uploads } = await urlRes.json();

  const uploadResults = await mapWithConcurrency(batch, STORAGE_UPLOAD_CONCURRENCY, async (item, index) => {
    const signed = uploads[index];
    if (!signed) return { item, error: 'Signed URL missing' };

    try {
      const uploadRes = await fetch(signed.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': getMimeType(item.name),
          'Content-Length': String(item.size),
        },
        body: fs.createReadStream(item.filePath),
      });

      if (!uploadRes.ok) {
        return { item, error: `Storage upload failed: ${uploadRes.status}` };
      }

      return { item, signed };
    } catch (err) {
      return { item, error: err.message };
    }
  });

  const confirmedUploads = [];
  for (const result of uploadResults) {
    if (result.error) {
      failOrRetry(result.item, result.error);
      continue;
    }

    confirmedUploads.push({
      eventId,
      storagePath: result.signed.storagePath,
      photoId: result.signed.photoId,
      originalFilename: result.item.name,
      fileSizeBytes: result.item.size,
      uploadSource: result.item.source,
    });
  }

  if (confirmedUploads.length === 0) return;

  const confirmRes = await fetch(`${global.appUrl}/api/photographer/confirm-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${global.authToken}`,
    },
    body: JSON.stringify({ eventId, uploads: confirmedUploads }),
  });

  if (!confirmRes.ok) {
    const err = await confirmRes.json();
    const message = err.error || 'Confirm failed';
    confirmedUploads.forEach((upload) => {
      const item = batch.find((batchItem) => batchItem.name === upload.originalFilename);
      if (item) failOrRetry(item, message);
    });
    return;
  }

  confirmedUploads.forEach((upload) => {
    const item = batch.find((b) => b.name === upload.originalFilename);
    // FTP files live in a temp dir — delete the local copy once it's
    // safely in storage. Folder-watched files are left alone (the user
    // probably wants their originals on disk).
    if (item?.cleanupAfterUpload && item.filePath) {
      fs.unlink(item.filePath, () => {});
    }
    mainWindow.webContents.send('upload-success', {
      name: upload.originalFilename,
      source: upload.uploadSource,
      queueRemaining: uploadQueue.length,
    });
  });
}
