// LexFlow — Encrypted Storage with Zero-Knowledge Master Password
// VERSIONE ASINCRONA (Non blocca la UI)
const fs = require('fs').promises; // Usa Promises per I/O non bloccante
const fsSync = require('fs'); // Sync solo per check rapidi
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');

const DATA_PATH = path.join(app.getPath('userData'), 'lexflow_vault.enc');
const AGENDA_PATH = path.join(app.getPath('userData'), 'lexflow_agenda.enc');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'lexflow_settings.json');
const ALGORITHM = 'aes-256-gcm';

// La chiave è protetta dal sistema operativo — mai in chiaro in RAM a lungo
let ENCRYPTED_SESSION_KEY = null;
let SESSION_SALT = null;

async function deriveKey(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

function protectKey(rawKeyBuffer) {
  if (safeStorage.isEncryptionAvailable()) {
    ENCRYPTED_SESSION_KEY = safeStorage.encryptString(rawKeyBuffer.toString('hex'));
  } else {
    ENCRYPTED_SESSION_KEY = rawKeyBuffer.toString('hex');
  }
  rawKeyBuffer.fill(0);
}

function getUnprotectedKey() {
  if (!ENCRYPTED_SESSION_KEY) throw new Error('Vault locked');
  if (safeStorage.isEncryptionAvailable() && Buffer.isBuffer(ENCRYPTED_SESSION_KEY)) {
    const decryptedHex = safeStorage.decryptString(ENCRYPTED_SESSION_KEY);
    return Buffer.from(decryptedHex, 'hex');
  }
  return Buffer.from(ENCRYPTED_SESSION_KEY, 'hex');
}

function encryptGCM(key, plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), authTag: authTag.toString('hex'), data: encrypted };
}

function decryptGCM(key, iv, authTag, data) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decryptCBC(key, iv, data) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  isVaultCreated() {
    return fsSync.existsSync(DATA_PATH);
  },

  async unlockVault(password) {
    try {
      if (!fsSync.existsSync(DATA_PATH)) {
        // First run
        const salt = crypto.randomBytes(16);
        const key = await deriveKey(password, salt);
        SESSION_SALT = salt;
        protectKey(key);
        await this.saveData([]); // Crea file vuoto

        // Genera recovery
        const recoveryCode = crypto.randomBytes(16).toString('hex').toUpperCase();
        const recoverySalt = crypto.randomBytes(32);
        const recoveryHash = crypto.pbkdf2Sync(recoveryCode, recoverySalt, 100000, 64, 'sha512');
        const settings = await this.getSettings();
        settings.recoveryHash = recoveryHash.toString('hex');
        settings.recoverySalt = recoverySalt.toString('hex');
        await this.saveSettings(settings);

        return { success: true, isNew: true, recoveryCode };
      }

      // Read file ASYNC
      const raw = await fs.readFile(DATA_PATH, 'utf8');
      const file = JSON.parse(raw);
      const salt = Buffer.from(file.salt, 'hex');
      const key = await deriveKey(password, salt);

      if (file.v === 2 && file.authTag) {
        decryptGCM(key, file.iv, file.authTag, file.data);
      } else {
        const iv = Buffer.from(file.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let check = decipher.update(file.check, 'hex', 'utf8');
        check += decipher.final('utf8');
        if (check !== 'LEXFLOW_OK') throw new Error('Wrong password');
      }

      SESSION_SALT = salt;
      protectKey(key);

      // Migrazione automatica se vecchio formato
      if (!file.v || file.v < 2) {
        const data = await this.loadData();
        await this.saveData(data);
        if (fsSync.existsSync(AGENDA_PATH)) {
          const agenda = await this.loadAgenda();
          await this.saveAgenda(agenda);
        }
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: 'Password errata o file corrotto.' };
    }
  },

  async loadData() {
    const tempKey = getUnprotectedKey();
    try {
      if (!fsSync.existsSync(DATA_PATH)) return [];
      const raw = await fs.readFile(DATA_PATH, 'utf8');
      const file = JSON.parse(raw);

      if (file.v === 2 && file.authTag) {
        const decrypted = decryptGCM(tempKey, file.iv, file.authTag, file.data);
        return JSON.parse(decrypted);
      } else {
        const decrypted = decryptCBC(tempKey, file.iv, file.data);
        return JSON.parse(decrypted);
      }
    } finally {
      tempKey.fill(0);
    }
  },

  async saveData(practices) {
    const tempKey = getUnprotectedKey();
    try {
      const saltHex = SESSION_SALT ? SESSION_SALT.toString('hex') : crypto.randomBytes(16).toString('hex');
      const { iv, authTag, data } = encryptGCM(tempKey, JSON.stringify(practices));

      const tempPath = `${DATA_PATH}.tmp`;
      // Scrittura asincrona su temp
      await fs.writeFile(tempPath, JSON.stringify({
        v: 2,
        salt: saltHex,
        iv,
        authTag,
        data
      }));
      // Rename atomico (molto veloce)
      await fs.rename(tempPath, DATA_PATH);
      return { success: true };
    } finally {
      tempKey.fill(0);
    }
  },

  async loadAgenda() {
    const tempKey = getUnprotectedKey();
    try {
      if (!fsSync.existsSync(AGENDA_PATH)) return [];
      const raw = await fs.readFile(AGENDA_PATH, 'utf8');
      const file = JSON.parse(raw);

      if (file.v === 2 && file.authTag) {
        const decrypted = decryptGCM(tempKey, file.iv, file.authTag, file.data);
        return JSON.parse(decrypted);
      } else {
        const decrypted = decryptCBC(tempKey, file.iv, file.data);
        return JSON.parse(decrypted);
      }
    } finally {
      tempKey.fill(0);
    }
  },

  async saveAgenda(events) {
    const tempKey = getUnprotectedKey();
    try {
      const saltHex = SESSION_SALT ? SESSION_SALT.toString('hex') : crypto.randomBytes(16).toString('hex');
      const { iv, authTag, data } = encryptGCM(tempKey, JSON.stringify(events));

      const tempPath = `${AGENDA_PATH}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify({
        v: 2,
        salt: saltHex,
        iv,
        authTag,
        data
      }));
      await fs.rename(tempPath, AGENDA_PATH);
      return { success: true };
    } finally {
      tempKey.fill(0);
    }
  },

  async getSettings() {
    try {
      if (fsSync.existsSync(SETTINGS_PATH)) {
        const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch {}
    return { privacyBlurEnabled: true };
  },

  async saveSettings(settings) {
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return { success: true };
  },

  lockVault() {
    if (ENCRYPTED_SESSION_KEY) {
      if (Buffer.isBuffer(ENCRYPTED_SESSION_KEY)) {
        try { ENCRYPTED_SESSION_KEY.fill(0); } catch {}
      }
      ENCRYPTED_SESSION_KEY = null;
    }
    SESSION_SALT = null;
    return { success: true };
  },

  deleteVault() {
    try { if (fsSync.existsSync(DATA_PATH)) fsSync.unlinkSync(DATA_PATH); } catch {}
    try { if (fsSync.existsSync(AGENDA_PATH)) fsSync.unlinkSync(AGENDA_PATH); } catch {}
  },

  async resetWithRecovery(code) {
    try {
      const settings = await this.getSettings();
      if (!settings.recoveryHash || !settings.recoverySalt) {
        return { success: false, error: 'Nessun codice di recupero impostato' };
      }
      const salt = Buffer.from(settings.recoverySalt, 'hex');
      const hash = crypto.pbkdf2Sync(code.toUpperCase(), salt, 100000, 64, 'sha512');
      if (hash.toString('hex') !== settings.recoveryHash) {
        return { success: false, error: 'Codice non valido' };
      }
      this.deleteVault();
      delete settings.recoveryHash;
      delete settings.recoverySalt;
      await this.saveSettings(settings);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Errore durante il recupero' };
    }
  }
};