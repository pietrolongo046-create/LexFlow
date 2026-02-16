import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Fingerprint, 
  Info, 
  Trash2, 
  Lock, 
  Download,
  Database
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage({ onLock }) {
  const [settings, setSettings] = useState({ privacyBlurEnabled: true });
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try { setSettings(await window.api.getSettings() || { privacyBlurEnabled: true }); } catch {}
    try {
      const av = await window.api.checkBio();
      setBioAvailable(av);
      if (av) setBioSaved(await window.api.hasBioSaved());
    } catch {}
    try { setAppVersion(await window.api.getAppVersion() || ''); } catch {}
  };

  const togglePrivacy = async () => {
    const updated = { ...settings, privacyBlurEnabled: !settings.privacyBlurEnabled };
    setSettings(updated);
    await window.api.saveSettings(updated);
    toast.success(updated.privacyBlurEnabled ? 'Protezione privacy attivata' : 'Protezione privacy disattivata');
  };

  const toggleBio = async () => {
    if (bioSaved) {
      await window.api.clearBio();
      setBioSaved(false);
      toast.success('Biometria rimossa');
    } else {
      toast((t) => (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium">Devi uscire e rientrare con la password per attivare la biometria.</span>
          <button className="btn-primary text-xs py-1.5 px-3 w-full justify-center" onClick={() => { toast.dismiss(t.id); onLock(); }}>Esci ora</button>
        </div>
      ), { duration: 6000, icon: '🔐' });
    }
  };

  const handleExportBackup = async () => {
    const pwd = prompt("Inserisci una password per proteggere questo backup (la userai per importarlo):");
    if (!pwd) return;
    if (pwd.length < 8) { toast.error('La password deve essere almeno di 8 caratteri'); return; }
    
    const toastId = toast.loading('Creazione backup cifrato...');
    try {
      const result = await window.api.exportBackup(pwd);
      if (result?.success) toast.success('Backup esportato con successo', { id: toastId });
      else if (!result?.cancelled) toast.error('Errore esportazione: ' + (result?.error || 'Sconosciuto'), { id: toastId });
      else toast.dismiss(toastId);
    } catch (e) {
      toast.error('Errore di sistema', { id: toastId });
    }
  };

  const handleResetVault = async () => {
    if (window.confirm("Sei sicuro? Cancellerai TUTTI i dati permanentemente.")) {
      const result = await window.api.resetVault();
      if (result?.success) { toast.success('Vault resettato'); window.location.reload(); }
    }
  };

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
      <div className="flex-shrink-0">{action}</div>
    </div>
  );

  return (
    <div className="main-content animate-slide-up">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Impostazioni</h1>
          <p className="text-text-muted text-sm">Configura la sicurezza e le preferenze.</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Sicurezza & Privacy</h2>
          <div className="space-y-3">
            <SettingItem icon={Shield} title="Protezione Privacy" desc="Oscura lo schermo quando l'app perde il focus." action={
              <button onClick={togglePrivacy} className={`relative w-12 h-6 rounded-full transition-all duration-300 ${settings.privacyBlurEnabled ? 'bg-primary' : 'bg-border'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${settings.privacyBlurEnabled ? 'left-6' : 'left-0.5'}`} />
              </button>
            }/>
            {bioAvailable && <SettingItem icon={Fingerprint} title="Autenticazione Biometrica" desc={bioSaved ? "Attiva (Touch ID/Face ID)" : "Disattivata"} action={
              <button onClick={toggleBio} className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${bioSaved ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>{bioSaved ? 'Rimuovi' : 'Attiva'}</button>
            }/>}
            <SettingItem icon={Lock} title="Blocca Sessione" desc="Chiudi l'accesso ai dati." action={<button onClick={onLock} className="btn-ghost text-xs font-bold px-4 py-2 border-primary/30 text-primary">Blocca Ora</button>}/>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wider ml-1">Dati & Backup</h2>
          <div className="space-y-3">
             <SettingItem icon={Database} title="Backup Portatile" desc="Esporta un file .lex cifrato per trasferire i dati su un altro PC." action={
              <button onClick={handleExportBackup} className="text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2">
                <Download size={14}/> Esporta
              </button>
            }/>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold text-danger uppercase tracking-wider ml-1">Zona Pericolo</h2>
          <SettingItem icon={Trash2} title="Reset Totale" desc="Elimina permanentemente tutti i dati." danger={true} action={
            <button onClick={handleResetVault} className="text-xs font-bold text-danger border border-danger/20 hover:bg-danger hover:text-white px-4 py-2 rounded-lg transition-all">Esegui Reset</button>
          }/>
        </section>

        <section className="space-y-4">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Info</h2>
            <div className="glass-card p-6 border border-white/5 bg-black/20 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 mx-auto"><Info className="text-primary w-6 h-6" /></div>
                <p className="text-sm font-bold text-white">LexFlow Desktop v{appVersion}</p>
                <p className="text-[10px] text-text-dim mt-2">AES-256 GCM · Zero-Knowledge · Hardware Bound</p>
            </div>
        </section>
      </div>
    </div>
  );
}