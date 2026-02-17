const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

// Percorsi dei file
const DATA_PATH = path.join(app.getPath('userData'), 'lexflow_vault.enc');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'lexflow_settings.json');

const ALGORITHM = 'aes-256-gcm';

// Cache in memoria (decifrata solo mentre l'app è sbloccata)
let cachedKey = null;
let memoryStore = {
  practices: [],
  agenda: []
};

// --- Helpers ---

// Scrittura Atomica: Scrive su un file .tmp e poi rinomina.
// Se il PC crasha durante la scrittura, il file originale rimane intatto.
function writeAtomic(filePath, content) {
  const tempPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath); // Operazione atomica su OS moderni
    return true;
  } catch (e) {
    console.error(`Errore scrittura atomica su ${filePath}:`, e);
    return false;
  }
}

// Derivazione chiave sicura (PBKDF2)
function deriveKey(password, salt) {
  // Salt deve essere un Buffer, Password una stringa
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

// Genera hash per il codice di recupero
function hashRecoveryCode(code, salt) {
  return crypto.pbkdf2Sync(code, salt, 100000, 64, 'sha512').toString('hex');
}

module.exports = {
  // Controlla se esiste un vault
  isVaultCreated() {
    return fs.existsSync(DATA_PATH);
  },

  // Sblocca o Crea il Vault
  async unlockVault(password) {
    try {
      // --- CREAZIONE NUOVO VAULT ---
      if (!fs.existsSync(DATA_PATH)) {
        const salt = crypto.randomBytes(16);
        const key = deriveKey(password, salt);
        cachedKey = key;
        
        // Inizializza memoria vuota
        memoryStore = { practices: [], agenda: [] };
        
        // Salva subito il file cifrato vuoto
        this._saveToDisk(salt);
        
        // Genera Codice di Recupero (A1B2-C3D4...)
        const recoveryCode = crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + 
                             crypto.randomBytes(4).toString('hex').toUpperCase();
        
        // Salva l'hash del codice di recupero nei settings
        const settings = await this.getSettings();
        const recSalt = crypto.randomBytes(16).toString('hex');
        settings.recoveryHash = hashRecoveryCode(recoveryCode, recSalt);
        settings.recoverySalt = recSalt;
        await this.saveSettings(settings);

        return { success: true, isNew: true, recoveryCode };
      }

      // --- SBLOCCO ESISTENTE ---
      const fileContent = fs.readFileSync(DATA_PATH, 'utf8');
      const json = JSON.parse(fileContent);
      
      const salt = Buffer.from(json.salt, 'hex');
      const iv = Buffer.from(json.iv, 'hex');
      const authTag = Buffer.from(json.authTag, 'hex');
      const key = deriveKey(password, salt);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(json.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      memoryStore = JSON.parse(decrypted);
      cachedKey = key; // Salva la chiave in RAM
      
      return { success: true, isNew: false };

    } catch (e) {
      console.error('Unlock failed:', e);
      cachedKey = null;
      return { success: false, error: 'Password errata o file corrotto' };
    }
  },

  // Blocca il Vault (cancella chiave e dati dalla RAM)
  lockVault() {
    cachedKey = null;
    memoryStore = { practices: [], agenda: [] };
    return { success: true };
  },

  // --- GESTIONE DATI ---

  async loadData() {
    if (!cachedKey) throw new Error('Vault Locked');
    return memoryStore.practices || [];
  },

  async saveData(practices) {
    if (!cachedKey) throw new Error('Vault Locked');
    memoryStore.practices = practices;
    this._saveToDisk();
    return true;
  },

  async loadAgenda() {
    if (!cachedKey) throw new Error('Vault Locked');
    return memoryStore.agenda || [];
  },

  async saveAgenda(agenda) {
    if (!cachedKey) throw new Error('Vault Locked');
    memoryStore.agenda = agenda;
    this._saveToDisk();
    return true;
  },

  // Helper interno per cifrare e scrivere su disco
  _saveToDisk(forceSalt = null) {
    if (!cachedKey) throw new Error("Tentativo di salvataggio senza chiave");

    // Dobbiamo recuperare il salt originale dal file esistente per mantenere coerente la chiave derivata
    // OPPURE usiamo quello passato in fase di creazione.
    // In questo design semplificato: cachedKey è già derivata. 
    // Il file su disco ha bisogno del sale per permettere la riapertura futura con la password.
    
    let saltHex;
    if (forceSalt) {
      saltHex = forceSalt.toString('hex');
    } else {
      // Leggi il sale dal file esistente per preservarlo
      if (fs.existsSync(DATA_PATH)) {
        const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        saltHex = existing.salt;
      } else {
         throw new Error("Impossibile recuperare il Salt crittografico");
      }
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, cachedKey, iv);
    
    // Cifra tutto lo store (Pratiche + Agenda)
    const payload = JSON.stringify(memoryStore);
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const output = JSON.stringify({
      v: 2, // Versione formato
      salt: saltHex,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });

    writeAtomic(DATA_PATH, output);
  },

  // --- SETTINGS & RECOVERY ---

  async getSettings() {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      }
    } catch {}
    return { privacyBlurEnabled: true };
  },

  async saveSettings(data) {
    // Merge con esistenti per non perdere recoveryHash se si salvano solo preferenze UI
    const current = await this.getSettings();
    const newSettings = { ...current, ...data };
    writeAtomic(SETTINGS_PATH, JSON.stringify(newSettings, null, 2));
    return true;
  },

  async resetWithRecovery(code) {
    try {
      const settings = await this.getSettings();
      if (!settings.recoveryHash || !settings.recoverySalt) {
        return { success: false, error: 'Nessun codice di recupero configurato.' };
      }

      // Normalizza codice (rimuovi trattini e spazi, uppercase)
      const cleanCode = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      
      // A volte il codice salvato è "ABCD-1234", proviamo a verificare l'hash
      // La logica di creazione sopra mette un trattino.
      // Se l'utente inserisce "ABCD1234", dobbiamo gestire la formattazione.
      // Per sicurezza verifichiamo l'hash così com'è o implementiamo una logica di normalizzazione robusta.
      // Qui assumiamo che l'utente inserisca il codice ESATTO.
      
      // Prova 1: Codice pulito
      let hash = hashRecoveryCode(cleanCode, settings.recoverySalt);
      let match = (hash === settings.recoveryHash);

      // Prova 2: Se fallisce, prova col formato con trattino (se l'utente l'ha omesso ma era salvato con)
      if (!match && cleanCode.length === 8) {
         const withDash = cleanCode.slice(0,4) + '-' + cleanCode.slice(4);
         hash = hashRecoveryCode(withDash, settings.recoverySalt);
         match = (hash === settings.recoveryHash);
      }
      
      if (match) {
        this.deleteVault();
        // Rimuovi dati di sicurezza ma mantieni preferenze
        delete settings.recoveryHash;
        delete settings.recoverySalt;
        await this.saveSettings(settings);
        return { success: true };
      }
      
      return { success: false, error: 'Codice di recupero non valido.' };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Errore durante il reset.' };
    }
  },

  deleteVault() {
    this.lockVault();
    if (fs.existsSync(DATA_PATH)) fs.unlinkSync(DATA_PATH);
    // Nota: Manteniamo i settings (es. privacyBlur) ma resettiamo le chiavi di recupero nel metodo sopra
  }
};