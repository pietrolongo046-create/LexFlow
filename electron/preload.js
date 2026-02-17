const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // --- Sicurezza ed Eventi ---
  onBlur: (cb) => ipcRenderer.on('app-blur', (_, val) => cb(val)),
  onVaultLocked: (cb) => ipcRenderer.on('vault-locked', () => cb()),
  onLock: (cb) => ipcRenderer.on('app-lock', () => cb()),
  onUpdateMsg: (cb) => ipcRenderer.on('update-msg', (_, msg) => cb(msg)),

  // --- Vault Core ---
  vaultExists: () => ipcRenderer.invoke('vault-exists'),
  unlockVault: (pwd) => ipcRenderer.invoke('vault-unlock', pwd),
  lockVault: () => ipcRenderer.invoke('vault-lock'),
  resetVault: () => ipcRenderer.invoke('vault-reset'),
  exportVault: (pwd) => ipcRenderer.invoke('vault-export', pwd), // Backup completo

  // --- Dati (Pratiche) ---
  loadPractices: () => ipcRenderer.invoke('vault-load'),
  savePractices: (data) => ipcRenderer.invoke('vault-save', data),

  // --- Dati (Agenda) ---
  loadAgenda: () => ipcRenderer.invoke('vault-load-agenda'),
  saveAgenda: (data) => ipcRenderer.invoke('vault-save-agenda', data),

  // --- Biometria ---
  checkBio: () => ipcRenderer.invoke('bio-check'),
  hasBioSaved: () => ipcRenderer.invoke('bio-has-saved'),
  saveBio: (pwd) => ipcRenderer.invoke('bio-save', pwd),
  loginBio: () => ipcRenderer.invoke('bio-login'),
  clearBio: () => ipcRenderer.invoke('bio-clear'),

  // --- File System & Export Sicuro ---
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  // Passa buffer e nome, il main gestisce il dialogo di salvataggio
  exportPDF: (buffer, defaultName) => ipcRenderer.invoke('export-pdf', { buffer, defaultName }),

  // --- Info Piattaforma & Impostazioni ---
  isMac: () => ipcRenderer.invoke('get-is-mac'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // --- Controlli Finestra ---
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});