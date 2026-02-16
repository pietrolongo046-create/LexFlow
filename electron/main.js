const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, dialog, clipboard, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const keychainService = require('./services/keychain');
const storage = require('./storage');
const biometrics = require('./biometrics');

const IS_MAC = process.platform === 'darwin';

// Menu translations
const menuT = {
  it: { about: 'Informazioni su LexFlow', hide: 'Nascondi LexFlow', hideOthers: 'Nascondi altri', showAll: 'Mostra tutti', quit: 'Esci da LexFlow', edit: 'Modifica', undo: 'Annulla', redo: 'Ripeti', cut: 'Taglia', copy: 'Copia', paste: 'Incolla', selectAll: 'Seleziona tutto', view: 'Vista', zoomIn: 'Zoom avanti', zoomOut: 'Zoom indietro', resetZoom: 'Zoom predefinito', fullscreen: 'Schermo intero', window: 'Finestra', minimize: 'Riduci', close: 'Chiudi' },
  en: { about: 'About LexFlow', hide: 'Hide LexFlow', hideOthers: 'Hide Others', showAll: 'Show All', quit: 'Quit LexFlow', edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', view: 'View', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', resetZoom: 'Actual Size', fullscreen: 'Toggle Full Screen', window: 'Window', minimize: 'Minimize', close: 'Close' },
};
function getT() { const l = (app.getLocale() || 'en').substring(0, 2); return menuT[l] || menuT.en; }

app.setAppUserModelId('com.technojaw.lexflow');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ===== IPC Handlers =====

// Security (Keytar)
ipcMain.handle('get-secure-key', () => keychainService.getEncryptionKey());

// Vault (Zero-Knowledge storage)
ipcMain.handle('vault-exists', () => storage.isVaultCreated());
ipcMain.handle('vault-unlock', (_, pwd) => storage.unlockVault(pwd));
ipcMain.handle('vault-lock', () => storage.lockVault());
ipcMain.handle('vault-load', () => storage.loadData());
ipcMain.handle('vault-save', (_, data) => storage.saveData(data));
ipcMain.handle('vault-load-agenda', () => storage.loadAgenda());
ipcMain.handle('vault-save-agenda', (_, data) => storage.saveAgenda(data));
ipcMain.handle('vault-recovery-reset', (_, code) => storage.resetWithRecovery(code));
ipcMain.handle('vault-reset', async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Annulla', 'Reset Vault'],
    defaultId: 0,
    cancelId: 0,
    title: 'Reset Vault',
    message: 'Sei sicuro? Tutti i dati delle pratiche verranno cancellati permanentemente.',
  });
  if (response === 1) {
    storage.lockVault();
    storage.deleteVault();
    return { success: true };
  }
  return { success: false };
});

// Folder linking
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});
ipcMain.handle('open-path', (_, p) => { if (p) shell.openPath(p); });

// Save dialog
ipcMain.handle('show-save-dialog', async (_, opts) => {
  const result = await dialog.showSaveDialog(mainWindow, opts);
  if (result.canceled) return null;
  return result.filePath;
});

// Platform
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-is-mac', () => IS_MAC);
ipcMain.handle('get-app-version', () => app.getVersion());

// Window controls
ipcMain.on('window-minimize', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); });

// Biometrics
ipcMain.handle('bio-check', () => biometrics.isAvailable());
ipcMain.handle('bio-has-saved', () => biometrics.hasSaved());
ipcMain.handle('bio-save', (_, pwd) => biometrics.savePassword(pwd));
ipcMain.handle('bio-login', () => biometrics.retrievePassword());
ipcMain.handle('bio-clear', () => biometrics.clear());

// Settings (non-encrypted, accessible before vault unlock)
ipcMain.handle('get-settings', () => storage.getSettings());
ipcMain.handle('save-settings', (_, data) => storage.saveSettings(data));

// ===== Window =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1000, minHeight: 700,
    title: 'LexFlow',
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'hidden',
    ...(IS_MAC ? { trafficLightPosition: { x: 16, y: 18 } } : {}),
    frame: IS_MAC,
    backgroundColor: '#0c0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: true,
      spellcheck: false,
    },
    icon: path.join(__dirname, '..', 'build', IS_MAC ? 'lexflow-icon.icns' : 'lexflow-icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // PRODUCTION HARDENING — DevTools blocked
  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // BLOCK new windows / pop-ups
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // BLOCK navigation away from app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });

  // BLOCK drag & drop of external files
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('dragover', e => e.preventDefault());
      document.addEventListener('drop', e => e.preventDefault());
    `);
  });

  // PRIVACY BLUR — richiede password dopo 30s di inattività
  let blurTimer = null;
  let blurTimestamp = 0;
  mainWindow.on('blur', () => {
    blurTimestamp = Date.now();
    mainWindow.webContents.send('app-blur', true);
    blurTimer = setTimeout(() => {
      mainWindow._shouldLockOnFocus = true;
    }, 30000);
  });
  mainWindow.on('focus', () => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    // Se il blur è durato meno di 3s (es. dialog Touch ID), rimuovi lo shield
    if (Date.now() - blurTimestamp < 3000) {
      mainWindow.webContents.send('app-blur', false);
    }
    // Se la flag è attiva, mostra il lock e resetta la flag
    if (mainWindow._shouldLockOnFocus) {
      mainWindow._shouldLockOnFocus = false;
      mainWindow.webContents.send('app-lock');
    }
  });

  // CLIPBOARD CLEAR + VAULT LOCK on close
  mainWindow.on('close', (e) => {
    clipboard.clear();
    storage.lockVault();
    if (IS_MAC && !isQuitting) {
      e.preventDefault();
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide(); }, 700);
      } else {
        mainWindow.hide();
      }
    }
  });

  // Block reload shortcuts in production
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.key === 'r' && (input.meta || input.control)) || (input.key === 'R' && (input.meta || input.control)) || input.key === 'F5') {
      event.preventDefault();
    }
  });
}

// ===== Tray =====
function createTray() {
  const trayIconPath = path.join(__dirname, '..', 'build', 'lexflow-tray.png');
  const trayIcon2xPath = path.join(__dirname, '..', 'build', 'lexflow-tray@2x.png');
  if (!fs.existsSync(trayIconPath)) return;
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 });
  // Add @2x for Retina
  if (fs.existsSync(trayIcon2xPath)) {
    icon.addRepresentation({ scaleFactor: 2.0, dataURL: nativeImage.createFromPath(trayIcon2xPath).toDataURL() });
  }
  // Color icon — NO template (shows app logo in both light/dark mode)
  tray = new Tray(icon);
  tray.setToolTip('LexFlow');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Apri LexFlow', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: '🔒 Blocca Vault', click: () => {
      storage.lockVault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('vault-locked');
        mainWindow.show();
        mainWindow.focus();
      }
    }},
    { type: 'separator' },
    { label: 'Esci', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); });
}

// ===== Menu =====
function buildMenu() {
  const t = getT();
  const template = [
    ...(IS_MAC ? [{
      label: 'LexFlow',
      submenu: [
        { role: 'about', label: t.about },
        { type: 'separator' },
        { role: 'hide', label: t.hide },
        { role: 'hideOthers', label: t.hideOthers },
        { role: 'unhide', label: t.showAll },
        { type: 'separator' },
        { role: 'quit', label: t.quit },
      ],
    }] : []),
    { label: t.edit, submenu: [
      { role: 'undo', label: t.undo }, { role: 'redo', label: t.redo },
      { type: 'separator' },
      { role: 'cut', label: t.cut }, { role: 'copy', label: t.copy },
      { role: 'paste', label: t.paste }, { role: 'selectAll', label: t.selectAll },
    ]},
    { label: t.view, submenu: [
      { role: 'zoomIn', label: t.zoomIn }, { role: 'zoomOut', label: t.zoomOut },
      { role: 'resetZoom', label: t.resetZoom },
      { type: 'separator' },
      { role: 'togglefullscreen', label: t.fullscreen },
    ]},
    ...(IS_MAC ? [{ label: t.window, submenu: [
      { role: 'minimize', label: t.minimize }, { role: 'close', label: t.close },
    ]}] : []),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ===== App Lifecycle =====
app.on('before-quit', () => { isQuitting = true; });

app.whenReady().then(() => {
  // NETWORK KILL-SWITCH — Block all external connections
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url.toLowerCase();
    if (url.startsWith('file:') || url.startsWith('http://localhost') || url.startsWith('devtools:')) {
      callback({ cancel: false });
    } else {
      callback({ cancel: true });
    }
  });

  // PERMISSION LOCKDOWN — deny all hardware/sensor requests
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));

  buildMenu();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => { if (!IS_MAC) app.quit(); });
app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  else createWindow();
});
