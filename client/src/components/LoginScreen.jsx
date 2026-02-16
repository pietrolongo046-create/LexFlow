import React, { useState, useRef } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Fingerprint } from 'lucide-react';
import logoSrc from '../assets/logo.png';

export default function LoginScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNew, setIsNew] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [bioFailed, setBioFailed] = useState(0);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const bioTriggered = useRef(false);
  const [recoveryCode, setRecoveryCode] = useState(null); // mostrato una sola volta

  const MAX_BIO_ATTEMPTS = 3;

  React.useEffect(() => {
    window.api.vaultExists().then(exists => {
      const newVault = !exists;
      setIsNew(newVault);
      if (newVault) setShowPasswordField(true); // Nuovo vault → mostra subito password
    });
    // Check biometrics availability
    window.api.checkBio().then(available => {
      setBioAvailable(available);
      if (available) {
        window.api.hasBioSaved().then(saved => {
          setBioSaved(saved);
          if (saved && !bioTriggered.current) {
            bioTriggered.current = true;
            // Auto-trigger Touch ID (solo se non è nuovo vault)
            setTimeout(() => {
              window.api.vaultExists().then(exists => {
                if (exists) handleBioLogin(true);
                else setShowPasswordField(true);
              });
            }, 400);
          } else if (!saved) {
            setShowPasswordField(true);
          }
        });
      } else {
        setShowPasswordField(true);
      }
    });
  }, []);

  const getStrength = (pwd) => {
    if (!pwd) return { label: '', color: '', pct: 0 };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Debole', color: '#f87171', pct: 20 };
    if (score <= 2) return { label: 'Sufficiente', color: '#fbbf24', pct: 40 };
    if (score <= 3) return { label: 'Buona', color: '#60a5fa', pct: 60 };
    if (score <= 4) return { label: 'Forte', color: '#34d399', pct: 80 };
    return { label: 'Eccellente', color: '#34d399', pct: 100 };
  };

  const isPasswordStrong = (pwd) => {
    return pwd.length >= 12 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isNew) {
      if (!isPasswordStrong(password)) {
        setError('La password DEVE avere: 12+ caratteri, maiuscole, minuscole, numeri e simboli.');
        return;
      }
      if (password !== confirm) { setError('Le password non corrispondono'); return; }
    }

    setLoading(true);
    try {
      const result = await window.api.unlockVault(password);
      if (result.success) {
        // After successful login, save for biometrics if available
        if (bioAvailable) {
          try { await window.api.saveBio(password); } catch {}
        }
        // Se nuovo vault, mostra recovery code
        if (result.isNew && result.recoveryCode) {
          setRecoveryCode(result.recoveryCode);
        } else {
          onUnlock();
        }
      } else {
        setError(result.error || 'Password errata');
      }
    } catch {
      setError('Errore di sistema');
    } finally {
      setLoading(false);
    }
  };

  const handleBioLogin = async (isAutomatic = false) => {
    setLoading(true);
    setError('');
    try {
      const savedPassword = await window.api.loginBio();
      if (savedPassword) {
        const result = await window.api.unlockVault(savedPassword);
        if (result.success) {
          onUnlock();
          return;
        } else {
          const newCount = bioFailed + 1;
          setBioFailed(newCount);
          if (newCount >= MAX_BIO_ATTEMPTS) setShowPasswordField(true);
          if (!isAutomatic) setError('Credenziali biometriche scadute. Usa la password.');
        }
      } else {
        const newCount = bioFailed + 1;
        setBioFailed(newCount);
        if (newCount >= MAX_BIO_ATTEMPTS) setShowPasswordField(true);
        if (!isAutomatic) setError('Nessuna credenziale biometrica salvata.');
      }
    } catch {
      const newCount = bioFailed + 1;
      setBioFailed(newCount);
      if (newCount >= MAX_BIO_ATTEMPTS) setShowPasswordField(true);
      if (!isAutomatic) setError('Riconoscimento annullato o fallito.');
    } finally {
      setLoading(false);
    }
  };

  if (isNew === null) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-pulse text-text-muted text-sm">Caricamento…</div>
    </div>
  );

  const strength = getStrength(password);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background relative drag-region">
      {/* Recovery Code Modal — mostrato una sola volta dopo creazione vault */}
      {recoveryCode && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-card border border-primary/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl no-drag">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">Codice di Recupero</h2>
            <p className="text-text-muted text-xs mb-6">
              Salva questo codice in un luogo sicuro. <strong className="text-danger">Viene mostrato UNA SOLA VOLTA</strong> e ti permetterà di resettare il vault in emergenza.
            </p>
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-6 select-all">
              <p className="font-mono text-lg text-primary tracking-[3px] break-all">{recoveryCode}</p>
            </div>
            <p className="text-[10px] text-text-dim mb-6">32 caratteri · Non sarà più recuperabile</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(recoveryCode);
                setRecoveryCode(null);
                onUnlock();
              }}
              className="btn-primary w-full justify-center"
            >
              Copia e Continua
            </button>
          </div>
        </div>
      )}

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="glass-card p-8 w-[400px] relative z-10 no-drag animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoSrc} alt="LexFlow" className="w-16 h-16 object-contain mb-4" draggable={false} />
          <h1 className="text-xl font-bold text-text">LexFlow</h1>
          <p className="text-text-muted text-xs mt-1">
            {isNew ? 'Crea la tua Master Password' : (showPasswordField ? 'Inserisci la tua Master Password' : 'Autenticazione biometrica…')}
          </p>
        </div>

        {/* Biometrics — auto-triggered, retry if still available */}
        {!isNew && bioAvailable && bioSaved && bioFailed < MAX_BIO_ATTEMPTS && !showPasswordField && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => handleBioLogin(false)}
              disabled={loading}
              className="w-full py-3 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-lg flex items-center justify-center gap-3 transition group"
            >
              <Fingerprint size={20} className="text-primary group-hover:scale-110 transition-transform" />
              <span className="text-sm font-semibold text-primary">Riprova Biometria</span>
            </button>
          </div>
        )}

        {/* Password form — secondaria o per nuovo vault */}
        {(isNew || showPasswordField) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type={showPwd ? 'text' : 'password'}
              className="input-field pl-10 pr-10"
              placeholder="Master Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text transition"
              onClick={() => setShowPwd(!showPwd)}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength meter (only for new vault) */}
          {isNew && password && (
            <div className="space-y-1">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${strength.pct}%`, background: strength.color }}
                />
              </div>
              <p className="text-xs text-right" style={{ color: strength.color }}>{strength.label}</p>
            </div>
          )}

          {/* Confirm */}
          {isNew && (
            <div className="relative">
              <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type={showPwd ? 'text' : 'password'}
                className="input-field pl-10"
                placeholder="Conferma Password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-danger text-xs text-center animate-shake">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isNew ? 'Creazione…' : 'Sblocco…'}
              </span>
            ) : (
              isNew ? 'Crea Vault' : 'Sblocca'
            )}
          </button>
        </form>
        )}

        {/* Error fuori dal form (per errori bio) */}
        {!showPasswordField && !isNew && error && (
          <p className="text-danger text-xs text-center animate-shake mt-4">{error}</p>
        )}

        {/* Reset vault — password dimenticata */}
        {!isNew && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={async () => {
                const result = await window.api.resetVault();
                if (result?.success) {
                  setIsNew(true);
                  setPassword('');
                  setConfirm('');
                  setError('');
                }
              }}
              className="text-text-dim hover:text-danger text-[11px] underline underline-offset-2 transition"
            >
              Password dimenticata? Reset Vault
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-text-dim text-[10px]">
          <Lock size={10} />
          <span>AES-256 · PBKDF2 · Zero-Knowledge</span>
        </div>
      </div>
    </div>
  );
}
