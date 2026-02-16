import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Fingerprint, 
  Info, 
  Trash2, 
  Lock, 
  Eye, 
  AlertTriangle 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage({ onLock }) {
  const [settings, setSettings] = useState({ privacyBlurEnabled: true });
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  // Caricamento iniziale di tutte le impostazioni dal processo Main
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const s = await window.api.getSettings();
      setSettings(s || { privacyBlurEnabled: true });
    } catch {}
    try {
      const available = await window.api.checkBio();
      setBioAvailable(available);
      if (available) {
        const saved = await window.api.hasBioSaved();
        setBioSaved(saved);
      }
    } catch {}
    try {
      const v = await window.api.getAppVersion();
      setAppVersion(v || '');
    } catch {}
  };

  // Gestione oscuramento privacy (Blur)
  const togglePrivacy = async () => {
    const updated = { ...settings, privacyBlurEnabled: !settings.privacyBlurEnabled };
    setSettings(updated);
    await window.api.saveSettings(updated);
    toast.success(updated.privacyBlurEnabled ? 'Protezione privacy attivata' : 'Protezione privacy disattivata');
  };

  // Gestione autenticazione biometrica
  const toggleBio = async () => {
    if (bioSaved) {
      await window.api.clearBio();
      setBioSaved(false);
      toast.success('Biometria rimossa');
    } else {
      toast('Biometria verrà salvata al prossimo login', { icon: '🔐' });
    }
  };

  // Reset totale del database cifrato
  const handleResetVault = async () => {
    if (window.confirm("Sei assolutamente sicuro? Questa azione cancellerà permanentemente tutti i fascicoli, l'agenda e le password.")) {
      const result = await window.api.resetVault();
      if (result?.success) {
        toast.success('Vault resettato con successo');
        window.location.reload();
      }
    }
  };

  // Componente interno per riga impostazione
  const SettingItem = ({ icon: Icon, title, desc, action, danger }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${danger ? 'bg-danger/10' : 'bg-primary/10'}`}>
          <Icon className={`w-5 h-5 ${danger ? 'text-danger' : 'text-primary'}`} />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">{title}</h3>
          <p className="text-xs text-text-muted">{desc}</p>
        </div>
      </div>
      <div className="flex-shrink-0">
        {action}
      </div>
    </div>
  );

  return (
    <div className="main-content animate-slide-up">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Impostazioni</h1>
          <p className="text-text-muted text-sm">Configura la sicurezza e le preferenze del tuo studio legale digitale.</p>
        </header>

        {/* Sezione Sicurezza & Privacy */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Sicurezza & Privacy</h2>
          
          <div className="space-y-3">
            {/* Privacy Blur */}
            <SettingItem
              icon={Shield}
              title="Protezione Privacy"
              desc={settings.privacyBlurEnabled
                ? 'Attiva — Lo schermo si offusca quando l\'app perde il focus. Richiede sblocco dopo 30s di inattività.'
                : 'Disattivata — Il contenuto rimane sempre visibile.'
              }
              action={
                <button
                  onClick={togglePrivacy}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                    settings.privacyBlurEnabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                    settings.privacyBlurEnabled ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              }
            />

            {/* Biometria (se disponibile) */}
            {bioAvailable && (
              <SettingItem
                icon={Fingerprint}
                title="Autenticazione Biometrica"
                desc="Usa Touch ID o Windows Hello per sbloccare rapidamente il vault."
                action={
                  <button
                    onClick={toggleBio}
                    className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                      bioSaved 
                      ? 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white' 
                      : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white'
                    }`}
                  >
                    {bioSaved ? 'Rimuovi' : 'Attiva'}
                  </button>
                }
              />
            )}

            {/* Blocco Manuale Rapido */}
            <SettingItem
              icon={Lock}
              title="Blocca Sessione"
              desc="Chiudi immediatamente l'accesso ai dati e torna alla schermata di login."
              action={
                <button onClick={onLock} className="btn-ghost text-xs font-bold px-4 py-2 border-primary/30 text-primary">
                  Blocca Ora
                </button>
              }
            />
          </div>
        </section>

        {/* Sezione Gestione Vault (Dati) */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-danger uppercase tracking-wider ml-1">Manutenzione Vault</h2>

          <SettingItem
            icon={Trash2}
            title="Reset Totale"
            desc="Elimina ogni traccia di dati, fascicoli e impostazioni. Questa operazione non può essere annullata."
            danger={true}
            action={
              <button
                onClick={handleResetVault}
                className="text-xs font-bold text-danger border border-danger/20 hover:bg-danger hover:text-white px-4 py-2 rounded-lg transition-all"
              >
                Esegui Reset
              </button>
            }
          />
        </section>

        {/* Info Applicazione */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Informazioni</h2>
          <div className="glass-card p-6 border border-white/5 bg-black/20">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Info className="text-primary w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">LexFlow Desktop</p>
              <p className="text-xs text-text-muted mt-1">Versione {appVersion || 'Stabile'}</p>
              <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <Shield size={10} className="text-success" />
                <span className="text-[10px] text-text-dim font-mono uppercase tracking-widest">Crittografia AES-256 GCM</span>
              </div>
              <p className="text-[10px] text-text-dim mt-6 leading-relaxed">
                Parte dell'ecosistema TechnoJaw.<br />
                I tuoi dati sono protetti da crittografia locale Zero-Knowledge.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}