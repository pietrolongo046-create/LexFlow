// LexFlow — Biometric Authentication (TouchID / FaceID)
// AES-256-GCM + Hardware ID Binding

const { systemPreferences, app } = require('electron');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Percorso del file delle credenziali biometriche
const BIO_FILE = path.join(app.getPath('userData'), '.lexflow_bio');
// Salt specifico per la derivazione della chiave macchina
const APP_SALT = 'LexFlow_Bio_v2_2026_GCM_Secure'; 
const ALGORITHM = 'aes-256-gcm';

// --- Hardware Binding ---
// Ottiene un identificativo hardware univoco per legare i dati alla macchina fisica
function getHardwareId() {
  try {
    // macOS: UUID IOPlatform
    if (process.platform === 'darwin') {
      const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8', stdio: 'pipe' });
      const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    }
    // Windows: UUID Motherboard
    if (process.platform === 'win32') {
      const out = execSync('wmic csproduct get uuid', { encoding: 'utf8', stdio: 'pipe' });
      const lines = out.trim().split('\n');
      // wmic output: "UUID\n<valore>\n\n"
      if (lines.length >= 2) {
        const uuid = lines[1].trim();
        if (uuid && uuid !== '') return uuid;
      }
    }
  } catch (e) {
    // Fallback silenzioso se i comandi di sistema falliscono
  }
  
  // Fallback stabile (meno univoco ma meglio di nulla)
  return `${os.hostname()}-${os.cpus()[0]?.model || 'cpu'}-${os.totalmem()}`;
}

let _machineKey = null;
function getMachineKey() {
  if (_machineKey) return _machineKey;
  
  const hwid = getHardwareId();
  // Combiniamo HWID con l'utente OS corrente per maggiore specificità
  const info = `${hwid}-${os.userInfo().username}`;
  
  // Derivazione chiave robusta (PBKDF2)
  _machineKey = crypto.pbkdf2Sync(info, APP_SALT, 100000, 32, 'sha512');
  return _machineKey;
}

// --- Encryption Core ---

function encryptToFile(plaintext) {
  try {
    const iv = crypto.randomBytes(16);
    const key = getMachineKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let enc = cipher.update(plaintext, 'utf8', 'hex');
    enc += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const tempPath = `${BIO_FILE}.tmp`;
    const payload = JSON.stringify({
      v: 2, // Versioning per compatibilità futura
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: enc
    });

    fs.writeFileSync(tempPath, payload, 'utf8');
    fs.renameSync(tempPath, BIO_FILE); // Scrittura atomica
    return true;
  } catch (err) {
    console.error('Bio save error:', err);
    return false;
  }
}

function decryptFromFile() {
  if (!fs.existsSync(BIO_FILE)) return null;
  try {
    const content = fs.readFileSync(BIO_FILE, 'utf8');
    let file;
    try { file = JSON.parse(content); } catch { return null; }

    const key = getMachineKey();

    // Supportiamo solo v2 (AES-GCM) per sicurezza.
    // I vecchi file legacy verranno ignorati (richiedendo un nuovo login, più sicuro).
    if (file.v === 2 && file.authTag && file.iv) {
      const iv = Buffer.from(file.iv, 'hex');
      const authTag = Buffer.from(file.authTag, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let dec = decipher.update(file.data, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    }
    
    return null; // Formato non riconosciuto o corrotto
  } catch (err) {
    console.error('Bio decrypt error:', err);
    return null;
  }
}

module.exports = {
  async isAvailable() {
    // macOS: Supporto nativo TouchID / FaceID
    if (process.platform === 'darwin') {
      return !!systemPreferences.canPromptTouchID && systemPreferences.canPromptTouchID();
    }
    
    // Windows: Electron NON supporta nativamente Windows Hello.
    // Ritornare 'true' qui creerebbe un bypass della sicurezza (autenticazione fake).
    // Disabilitiamo la biometria su Windows per garantire la sicurezza del Vault.
    return false; 
  },

  async prompt() {
    if (process.platform === 'darwin') {
      try {
        await systemPreferences.promptTouchID('Sblocca LexFlow');
        return true;
      } catch (e) {
        console.warn('Bio prompt failed/cancelled:', e);
        return false;
      }
    }
    return false; 
  },

  async hasSaved() {
    return fs.existsSync(BIO_FILE);
  },

  async savePassword(password) {
    if (!password) return false;
    // Salviamo solo se la biometria è realmente disponibile sulla piattaforma
    if (!await this.isAvailable()) return false; 
    return encryptToFile(password);
  },

  async retrievePassword() {
    // Controlli di sicurezza a cascata
    if (!await this.isAvailable()) throw new Error('Biometria non disponibile su questo dispositivo');
    if (!await this.hasSaved()) throw new Error('Nessuna credenziale salvata');

    // Richiesta interattiva all'utente (Prompt OS)
    const authorized = await this.prompt();
    if (!authorized) throw new Error('Autenticazione biometrica fallita o annullata');
    
    // Decifratura
    const pwd = decryptFromFile();
    if (!pwd) throw new Error('Impossibile decifrare le credenziali (File corrotto o hardware cambiato)');
    
    return pwd;
  },

  async clear() {
    try { 
      if (fs.existsSync(BIO_FILE)) fs.unlinkSync(BIO_FILE); 
      return true;
    } catch { return false; }
  }
};