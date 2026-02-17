import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Eye, 
  FileText, 
  HardDrive, 
  LogOut,
  RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage({ onLock }) {
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [appVersion, setAppVersion] = useState('');
  const [platform, setPlatform] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Carica versione e piattaforma
    if (window.api) {
      window.api.getAppVersion().then(setAppVersion);
      window.api.isMac().then(isMac => setPlatform(isMac ? 'macOS' : 'Windows'));
      
      // Carica impostazioni salvate
      window.api.getSettings().then(settings => {
        if (settings && typeof settings.privacyBlurEnabled === 'boolean') {
          setPrivacyEnabled(settings.privacyBlurEnabled);
        }
      });
    }
  }, []);

  const handlePrivacyToggle = async () => {
    const newValue = !privacyEnabled;
    setPrivacyEnabled(newValue);
    
    try {
      // Salva nel backend JSON
      await window.api.saveSettings({ privacyBlurEnabled: newValue });
      toast.success(newValue ? 'Privacy Blur Attivato' : 'Privacy Blur Disattivato');
    } catch (error) {
      console.error(error);
      toast.error('Errore salvataggio impostazioni');
      // Revert in caso di errore
      setPrivacyEnabled(!newValue); 
    }
  };

  const handleExportBackup = async () => {
    const pwd = prompt("Inserisci una password per cifrare il backup:");
    if (!pwd) return;

    setLoading(true);
    const toastId = toast.loading('Esportazione in corso...');
    
    try {
      const result = await window.api.exportVault(pwd);
      if (result.success) {
        toast.success('Backup esportato con successo!', { id: toastId });
      } else if (!result.cancelled) {
        toast.error('Errore esportazione: ' + (result.error || 'Sconosciuto'), { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (e) {
      toast.error('Errore critico backup', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Impostazioni</h1>
          <p className="text-text-muted text-sm">Gestisci sicurezza e preferenze di LexFlow.</p>
        </div>
        <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-xs font-mono text-text-dim">
          v{appVersion} • {platform}
        </div>
      </div>

      <div className="grid gap-6">
        
        {/* Sezione Sicurezza */}
        <section className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
            <Shield className="text-primary" size={20} />
            <h2 className="text-lg font-bold text-white">Sicurezza & Privacy</h2>
          </div>

          {/* Privacy Blur Toggle */}
          <div className="flex items-center justify-between group">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">Privacy Blur</span>
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/20">RECCOMENDED</span>
              </div>
              <p className="text-xs text-text-muted max-w-md">
                Sfoca automaticamente il contenuto dell'applicazione quando cambi finestra o perdi il focus, proteggendo i dati da sguardi indiscreti.
              </p>
            </div>
            
            <button 
              onClick={handlePrivacyToggle}
              className={`w-12 h-6 rounded-full transition-colors relative ${privacyEnabled ? 'bg-primary' : 'bg-white/10'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${privacyEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Azioni Immediate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <button 
              onClick={onLock}
              className="flex items-center justify-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
            >
              <Lock size={18} className="text-text-dim group-hover:text-white transition-colors" />
              <span className="text-sm font-medium">Blocca Vault Ora</span>
            </button>
            
            <button 
              onClick={() => {
                if(confirm("Questa azione cancellerà tutte le credenziali biometriche salvate. Continuare?")) {
                  window.api.clearBio().then(() => toast.success("Biometria resettata"));
                }
              }}
              className="flex items-center justify-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
            >
              <RefreshCw size={18} className="text-text-dim group-hover:text-white transition-colors" />
              <span className="text-sm font-medium">Resetta Biometria</span>
            </button>
          </div>
        </section>

        {/* Sezione Dati */}
        <section className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
            <HardDrive className="text-emerald-500" size={20} />
            <h2 className="text-lg font-bold text-white">Gestione Dati</h2>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="font-medium text-white">Backup Crittografato</span>
              <p className="text-xs text-text-muted">
                Esporta tutti i tuoi fascicoli e l'agenda in un unico file `.lex` cifrato, trasportabile su altri dispositivi.
              </p>
            </div>
            <button 
              onClick={handleExportBackup} 
              disabled={loading}
              className="btn-secondary px-4 py-2 text-sm"
            >
              {loading ? 'Esportazione...' : 'Esporta Backup'}
            </button>
          </div>
        </section>
      </div>

      {/* Footer Danger Zone */}
      <div className="pt-8 text-center">
        <button 
          onClick={async () => {
            if(confirm("ATTENZIONE: Stai per cancellare l'intero database. Questa azione è irreversibile. Sei sicuro?")) {
               const res = await window.api.resetVault();
               if(res.success) window.location.reload();
            }
          }}
          className="text-xs font-bold text-red-500/50 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <LogOut size={14} />
          Factory Reset Vault
        </button>
      </div>
    </div>
  );
}