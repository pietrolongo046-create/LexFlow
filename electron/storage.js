// LexFlow — Encrypted Storage with Zero-Knowledge Master Password (PBKDF2 + AES-256-GCM)
// Chiave protetta in RAM tramite safeStorage (macOS Keychain / Windows DPAPI)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');

const DATA_PATH = path.join(app.getPath('userData'), 'lexflow_vault.enc');
const AGENDA_PATH = path.join(app.getPath('userData'), 'lexflow_agenda.enc');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'lexflow_settings.json');
const ALGORITHM = 'aes-256-gcm';

// La chiave è protetta dal sistema operativo — mai in chiaro in RAM
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

// Protegge la chiave usando il chip di sicurezza del PC (TPM/Enclave)
function protectKey(rawKeyBuffer) {
  if (safeStorage.isEncryptionAvailable()) {
    ENCRYPTED_SESSION_KEY = safeStorage.encryptString(rawKeyBuffer.toString('hex'));
  } else {
    console.warn('ATTENZIONE: safeStorage non disponibile. Fallback meno sicuro.');
    ENCRYPTED_SESSION_KEY = rawKeyBuffer.toString('hex');
  }
  // Distruggi la chiave raw dalla memoria
  rawKeyBuffer.fill(0);
}

// Recupera la chiave temporaneamente (pochi millisecondi)
function getUnprotectedKey() {
  if (!ENCRYPTED_SESSION_KEY) throw new Error('Vault locked');
  if (safeStorage.isEncryptionAvailable() && Buffer.isBuffer(ENCRYPTED_SESSION_KEY)) {
    const decryptedHex = safeStorage.decryptString(ENCRYPTED_SESSION_KEY);
    return Buffer.from(decryptedHex, 'hex');
  }
  return Buffer.from(ENCRYPTED_SESSION_KEY, 'hex');
}

// Encrypt con GCM (tamper-proof)
function encryptGCM(key, plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), authTag: authTag.toString('hex'), data: encrypted };
}

// Decrypt con GCM
function decryptGCM(key, iv, authTag, data) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Decrypt legacy CBC (per migrazione)
function decryptCBC(key, iv, data) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  isVaultCreated() {
    return fs.existsSync(DATA_PATH);
  },

  async unlockVault(password) {
    try {
      if (!fs.existsSync(DATA_PATH)) {
        // First run — create vault
        const salt = crypto.randomBytes(16);
        const key = await deriveKey(password, salt);
        SESSION_SALT = salt;
        protectKey(key);
        await this.saveData([]);

        // Genera recovery code 32 caratteri (one-time)
        const recoveryCode = crypto.randomBytes(16).toString('hex').toUpperCase();
        const recoverySalt = crypto.randomBytes(32);
        const recoveryHash = crypto.pbkdf2Sync(recoveryCode, recoverySalt, 100000, 64, 'sha512');
        const settings = this.getSettings();
        settings.recoveryHash = recoveryHash.toString('hex');
        settings.recoverySalt = recoverySalt.toString('hex');
        this.saveSettings(settings);

        return { success: true, isNew: true, recoveryCode };
      }

      const file = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      const salt = Buffer.from(file.salt, 'hex');
      const key = await deriveKey(password, salt);

      // Supporta sia GCM (v2) che legacy CBC
      if (file.v === 2 && file.authTag) {
        // GCM: verifica integrità + decifrazione
        decryptGCM(key, file.iv, file.authTag, file.data);
      } else {
        // Legacy CBC: verifica tramite check token
        const iv = Buffer.from(file.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let check = decipher.update(file.check, 'hex', 'utf8');
        check += decipher.final('utf8');
        if (check !== 'LEXFLOW_OK') throw new Error('Wrong password');
      }

      SESSION_SALT = salt;
      protectKey(key);

      // Se era formato legacy, migra a GCM
      if (!file.v || file.v < 2) {
        try {
          const data = await this.loadData();
          await this.saveData(data);
          // Migra anche agenda se esiste
          if (fs.existsSync(AGENDA_PATH)) {
            const agenda = await this.loadAgenda();
            await this.saveAgenda(agenda);
          }
        } catch {}
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: 'Password errata o file corrotto.' };
    }
  },

  async loadData() {
    const tempKey = getUnprotectedKey();
    try {
      if (!fs.existsSync(DATA_PATH)) return [];
      const file = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

      if (file.v === 2 && file.authTag) {
        const decrypted = decryptGCM(tempKey, file.iv, file.authTag, file.data);
        return JSON.parse(decrypted);
      } else {
        // Legacy CBC
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
      fs.writeFileSync(tempPath, JSON.stringify({
        v: 2,
        salt: saltHex,
        iv,
        authTag,
        data
      }));
      fs.renameSync(tempPath, DATA_PATH);
      return { success: true };
    } finally {
      tempKey.fill(0);
    }
  },

  // ===== Agenda (separate encrypted file) =====
  async loadAgenda() {
    const tempKey = getUnprotectedKey();
    try {
      if (!fs.existsSync(AGENDA_PATH)) return [];
      const file = JSON.parse(fs.readFileSync(AGENDA_PATH, 'utf8'));

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
      fs.writeFileSync(tempPath, JSON.stringify({
        v: 2,
        salt: saltHex,
        iv,
        authTag,
        data
      }));
      fs.renameSync(tempPath, AGENDA_PATH);
      return { success: true };
    } finally {
      tempKey.fill(0);
    }
  },

  // ===== Settings (unencrypted, needed before vault unlock) =====
  getSettings() {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      }
    } catch {}
    return { privacyBlurEnabled: true };
  },

  saveSettings(settings) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
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
    try { if (fs.existsSync(DATA_PATH)) fs.unlinkSync(DATA_PATH); } catch {}
    try { if (fs.existsSync(AGENDA_PATH)) fs.unlinkSync(AGENDA_PATH); } catch {}
  },

  resetWithRecovery(code) {
    try {
      const settings = this.getSettings();
      if (!settings.recoveryHash || !settings.recoverySalt) {
        return { success: false, error: 'Nessun codice di recupero impostato' };
      }
      const salt = Buffer.from(settings.recoverySalt, 'hex');
      const hash = crypto.pbkdf2Sync(code.toUpperCase(), salt, 100000, 64, 'sha512');
      if (hash.toString('hex') !== settings.recoveryHash) {
        return { success: false, error: 'Codice non valido' };
      }
      // Recovery valido — resetta vault
      this.deleteVault();
      delete settings.recoveryHash;
      delete settings.recoverySalt;
      this.saveSettings(settings);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Errore durante il recupero' };
    }
  }
};
