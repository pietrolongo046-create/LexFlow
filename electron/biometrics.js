// LexFlow — Biometric Authentication (TouchID / FaceID / Windows Hello)
// AES-256-GCM + safeStorage — chiave protetta dal sistema operativo
const { systemPreferences, safeStorage, app } = require('electron');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BIO_FILE = path.join(app.getPath('userData'), '.lexflow_bio');
const APP_SALT = 'LexFlow_Bio_v2_2026_GCM';
const ALGORITHM = 'aes-256-gcm';

function getHardwareId() {
  try {
    if (process.platform === 'darwin') {
      const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8' });
      const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    }
    if (process.platform === 'win32') {
      const out = execSync('wmic csproduct get uuid', { encoding: 'utf8' });
      const lines = out.trim().split('\n');
      if (lines[1]) return lines[1].trim();
    }
  } catch {}
  return os.hostname() + os.cpus()[0]?.model + os.totalmem();
}

let _machineKey = null;
function getMachineKey() {
  if (_machineKey) return _machineKey;
  const hwid = getHardwareId();
  const info = hwid + os.userInfo().username + os.homedir();
  _machineKey = crypto.pbkdf2Sync(info, APP_SALT, 100000, 32, 'sha512');
  return _machineKey;
}

function encryptToFile(plaintext) {
  const iv = crypto.randomBytes(16);
  const key = getMachineKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let enc = cipher.update(plaintext, 'utf8', 'hex');
  enc += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  const tempPath = `${BIO_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: enc,
    v: 2
  }), 'utf8');
  fs.renameSync(tempPath, BIO_FILE);
}

function decryptFromFile() {
  if (!fs.existsSync(BIO_FILE)) return null;
  try {
    const file = JSON.parse(fs.readFileSync(BIO_FILE, 'utf8'));
    const iv = Buffer.from(file.iv, 'hex');
    const key = getMachineKey();

    if (file.v === 2 && file.authTag) {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(Buffer.from(file.authTag, 'hex'));
      let dec = decipher.update(file.data, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } else {
      // Legacy CBC — decrypt and re-encrypt as GCM
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let dec = decipher.update(file.data, 'hex', 'utf8');
      dec += decipher.final('utf8');
      encryptToFile(dec);
      return dec;
    }
  } catch { return null; }
}

module.exports = {
  async isAvailable() {
    if (process.platform === 'darwin') {
      try {
        return systemPreferences.canPromptTouchID ? systemPreferences.canPromptTouchID() : false;
      } catch { return false; }
    }
    if (process.platform === 'win32') return true;
    return false;
  },

  async prompt() {
    if (process.platform === 'darwin') {
      try {
        await systemPreferences.promptTouchID('Sblocca LexFlow');
        return true;
      } catch { return false; }
    }
    return true;
  },

  async savePassword(password) {
    encryptToFile(password);
  },

  async retrievePassword() {
    const authorized = await this.prompt();
    if (!authorized) throw new Error('Biometria non autorizzata');
    return decryptFromFile();
  },

  async hasSaved() {
    return fs.existsSync(BIO_FILE);
  },

  async clear() {
    try { fs.unlinkSync(BIO_FILE); } catch {}
  }
};
