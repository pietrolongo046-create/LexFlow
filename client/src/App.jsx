import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import WindowControls from './components/WindowControls';
import Dashboard from './pages/Dashboard';
import PracticesList from './pages/PracticesList';
import DeadlinesPage from './pages/DeadlinesPage';
import AgendaPage from './pages/AgendaPage';
import SettingsPage from './pages/SettingsPage';
import PracticeDetail from './components/PracticeDetail';
import CreatePracticeModal from './components/CreatePracticeModal';

export default function App() {
  const navigate = useNavigate();
  
  // --- Stati Globali ---
  const [isLocked, setIsLocked] = useState(true);
  const [blurred, setBlurred] = useState(false);
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [version, setVersion] = useState('');
  
  // --- Stati Dati (Lifted State) ---
  const [practices, setPractices] = useState([]);
  const [agendaEvents, setAgendaEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // --- 1. Inizializzazione ---
  useEffect(() => {
    // Carica versione
    if (window.api?.getAppVersion) {
      window.api.getAppVersion().then(v => setVersion(v || '')).catch(() => {});
    }
    
    // Carica impostazioni (gestisce il caso in cui l'API non sia esposta)
    if (window.api?.getSettings) {
      window.api.getSettings().then(s => {
        if (s && typeof s.privacyBlurEnabled === 'boolean') {
            setPrivacyEnabled(s.privacyBlurEnabled);
        }
      }).catch(err => console.warn("Errore caricamento settings:", err));
    }
  }, []);

  // --- 2. Gestione Sicurezza (Blur & Lock) ---
  const handleLockLocal = useCallback(() => {
    setBlurred(false);
    setPractices([]); // Pulisce la memoria visuale per sicurezza
    setAgendaEvents([]);
    setSelectedId(null);
    setIsLocked(true);
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    if (!window.api) return;

    // Listener Privacy Blur
    // Nota: Aggiungiamo controlli di esistenza per ogni funzione API
    const removeBlur = window.api.onBlur ? window.api.onBlur((val) => {
      if (privacyEnabled) setBlurred(val);
    }) : () => {};

    // Listener Lock (Automatico o da Tray)
    const handleRemoteLock = () => handleLockLocal();
    
    const removeLock = window.api.onLock ? window.api.onLock(handleRemoteLock) : () => {};
    const removeVaultLocked = window.api.onVaultLocked ? window.api.onVaultLocked(handleRemoteLock) : () => {};

    return () => {
      if (removeBlur) removeBlur();
      if (removeLock) removeLock();
      if (removeVaultLocked) removeVaultLocked();
    };
  }, [privacyEnabled, handleLockLocal]);

  const handleManualLock = async () => {
    if (window.api?.lockVault) {
        try {
            await window.api.lockVault();
        } catch (e) {
            console.error("Errore durante il blocco manuale:", e);
        }
    }
    handleLockLocal();
  };

  // --- 3. Logica Dati & Sync ---
  
  // Sincronizza scadenze delle pratiche nell'agenda globale
  const syncDeadlinesToAgenda = useCallback((newPractices, currentAgenda) => {
    // Mantieni eventi manuali (non 'scadenza' generata automaticamente)
    const manualEvents = currentAgenda.filter(e => !e.autoSync);
    const syncedEvents = [];
    
    newPractices.filter(p => p.status === 'active').forEach(p => {
      (p.deadlines || []).forEach(d => {
        // ID univoco basato su pratica e data per evitare duplicati
        const uniqueId = `deadline_${p.id}_${d.date}_${d.label.replace(/\s+/g, '_')}`;
        
        syncedEvents.push({
          id: uniqueId,
          title: `📋 ${d.label}`,
          date: d.date,
          timeStart: '09:00', // Orario default
          timeEnd: '10:00',
          category: 'scadenza',
          notes: `Fascicolo: ${p.client} — ${p.object}`,
          completed: false,
          autoSync: true, // Flag per identificare eventi generati
          practiceId: p.id,
        });
      });
    });
    return [...manualEvents, ...syncedEvents];
  }, []);

  const loadAllData = useCallback(async () => {
    if (!window.api) return;
    try {
      const pracs = await window.api.loadPractices().catch(() => []) || [];
      const agenda = await window.api.loadAgenda().catch(() => []) || [];
      
      setPractices(pracs);
      const synced = syncDeadlinesToAgenda(pracs, agenda);
      setAgendaEvents(synced);
      
      // Salva l'agenda sincronizzata per coerenza immediata
      await window.api.saveAgenda(synced).catch(e => console.warn("Save sync agenda failed", e));
    } catch (e) { 
      console.error("Errore caricamento dati:", e); 
    }
  }, [syncDeadlinesToAgenda]);

  const handleUnlock = async () => {
    setBlurred(false);
    setIsLocked(false);
    await loadAllData(); // Ricarica i dati freschi dopo lo sblocco
  };

  const savePractices = async (newPractices) => {
    setPractices(newPractices);
    if (window.api?.savePractices) {
        await window.api.savePractices(newPractices);
        
        // Aggiorna agenda
        const currentAgenda = agendaEvents;
        const synced = syncDeadlinesToAgenda(newPractices, currentAgenda);
        setAgendaEvents(synced);
        if (window.api?.saveAgenda) await window.api.saveAgenda(synced);
    }
  };

  const saveAgenda = async (newEvents) => {
    setAgendaEvents(newEvents);
    if (window.api?.saveAgenda) await window.api.saveAgenda(newEvents);
  };

  const handleSelectPractice = (id) => {
    setSelectedId(id);
    navigate('/pratiche');
  };

  // --- 4. Render ---
  
  // Vista Bloccata (Login)
  if (isLocked) {
    return (
      <>
        <WindowControls />
        {/* Passiamo handleUnlock che caricherà i dati al successo */}
        <LoginScreen onUnlock={handleUnlock} />
      </>
    );
  }

  const selectedPractice = practices.find(p => p.id === selectedId);

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden border border-white/5 rounded-lg shadow-2xl relative">
      
      {/* Privacy Shield (Overlay Sfocato) */}
      {privacyEnabled && blurred && (
        <div 
          className="fixed inset-0 z-[9999] bg-[#0c0d14]/80 backdrop-blur-3xl flex items-center justify-center transition-opacity duration-300 cursor-pointer animate-fade-in"
          onClick={handleManualLock}
          title="Clicca per bloccare il Vault"
        >
          <div className="text-center">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse border border-primary/20">
              <Lock size={40} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">LexFlow Protetto</h2>
            <p className="text-text-muted text-sm mt-2">Contenuto nascosto per privacy.<br/>Clicca per bloccare il Vault.</p>
          </div>
        </div>
      )}

      {/* Sidebar & Navigazione */}
      <Sidebar 
        version={version} 
        onLock={handleManualLock} 
        activePage={location.pathname} // Passa la rotta attiva per l'evidenziazione
      />

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-hidden relative flex flex-col bg-gradient-to-br from-background to-[#13141f]">
        <WindowControls />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#13141e', color: '#e2e4ef', border: '1px solid #22263a', fontSize: '13px' }
          }}
        />

        <div className="flex-1 overflow-auto p-8 pt-4">
          <Routes>
            <Route path="/" element={
              <Dashboard
                practices={practices}
                onNavigate={navigate}
                onSelectPractice={handleSelectPractice}
                onNewPractice={() => setShowCreate(true)}
              />
            } />
            
            <Route path="/pratiche" element={
              selectedId && selectedPractice ? (
                <PracticeDetail
                  practice={selectedPractice}
                  onBack={() => setSelectedId(null)}
                  onUpdate={(up) => {
                    const newList = practices.map(p => p.id === up.id ? up : p);
                    savePractices(newList);
                  }}
                />
              ) : (
                <PracticesList
                  practices={practices}
                  onSelect={handleSelectPractice}
                  onNewPractice={() => setShowCreate(true)}
                />
              )
            } />
            
            <Route path="/scadenze" element={
              <DeadlinesPage practices={practices} onSelectPractice={handleSelectPractice} />
            } />
            
            <Route path="/agenda" element={
              <AgendaPage
                agendaEvents={agendaEvents}
                onSaveAgenda={saveAgenda}
                practices={practices}
                onSelectPractice={handleSelectPractice}
              />
            } />
            
            <Route path="/settings" element={<SettingsPage onLock={handleManualLock} />} />
            <Route path="/sicurezza" element={<SettingsPage onLock={handleManualLock} />} />
          </Routes>
        </div>
      </main>

      {/* Modale Creazione */}
      {showCreate && (
        <CreatePracticeModal
          onClose={() => setShowCreate(false)}
          onSave={(p) => savePractices([p, ...practices])}
        />
      )}
    </div>
  );
}