const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Security
  getSecureKey: () => ipcRenderer.invoke('get-secure-key'),
  onBlur: (cb) => ipcRenderer.on('app-blur', (_, val) => cb(val)),
  onVaultLocked: (cb) => ipcRenderer.on('vault-locked', () => cb()),
  onLock: (cb) => ipcRenderer.on('app-lock', () => cb()),

  // Vault (Zero-Knowledge)
  vaultExists: () => ipcRenderer.invoke('vault-exists'),
  unlockVault: (pwd) => ipcRenderer.invoke('vault-unlock', pwd),
  lockVault: () => ipcRenderer.invoke('vault-lock'),
  resetVault: () => ipcRenderer.invoke('vault-reset'),
  recoveryReset: (code) => ipcRenderer.invoke('vault-recovery-reset', code),
  loadPractices: () => ipcRenderer.invoke('vault-load'),
  savePractices: (data) => ipcRenderer.invoke('vault-save', data),

  // Agenda
  loadAgenda: () => ipcRenderer.invoke('vault-load-agenda'),
  saveAgenda: (data) => ipcRenderer.invoke('vault-save-agenda', data),

  // Biometrics
  checkBio: () => ipcRenderer.invoke('bio-check'),
  hasBioSaved: () => ipcRenderer.invoke('bio-has-saved'),
  saveBio: (pwd) => ipcRenderer.invoke('bio-save', pwd),
  loginBio: () => ipcRenderer.invoke('bio-login'),
  clearBio: () => ipcRenderer.invoke('bio-clear'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // Folder linking
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),

  // Export PDF (save dialog)
  showSaveDialog: (opts) => ipcRenderer.invoke('show-save-dialog', opts),

  // Platform
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  isMac: () => ipcRenderer.invoke('get-is-mac'),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});
