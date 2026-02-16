import React from 'react';
import { Briefcase, CalendarClock, AlertTriangle, ChevronRight, Plus, Scale } from 'lucide-react';

const TYPE_LABELS = { civile: 'Civile', penale: 'Penale', amm: 'Amministrativo', stra: 'Stragiudiziale' };
const TYPE_BADGE = { civile: 'badge-civile', penale: 'badge-penale', amm: 'badge-amm', stra: 'badge-stra' };

export default function Dashboard({ practices, onNavigate, onSelectPractice, onNewPractice }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activePractices = practices.filter(p => p.status === 'active');
  const closedCount = practices.filter(p => p.status === 'closed').length;

  // Calcolo scadenze urgenti (prossimi 7 giorni)
  const urgentDeadlines = [];
  activePractices.forEach(p => {
    (p.deadlines || []).forEach(d => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 7) {
        urgentDeadlines.push({ ...d, practiceId: p.id, client: p.client, object: p.object, diffDays });
      }
    });
  });
  urgentDeadlines.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Conteggio task pendenti
  const pendingTasks = activePractices.reduce((acc, p) =>
    acc + (p.tasks || []).filter(t => !t.done).length, 0
  );

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="main-content animate-slide-up">
      {/* Header Aggiornato */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-text-muted text-sm mt-1">Benvenuto nel tuo studio legale digitale</p>
      </div>

      {/* Griglia Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Briefcase size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{activePractices.length}</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Attivi</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
            <Scale size={18} className="text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{closedCount}</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Chiusi</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
            <CalendarClock size={18} className="text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{urgentDeadlines.length}</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Scadenze</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{pendingTasks}</p>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Attività</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Scadenze Imminenti */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <CalendarClock size={16} className="text-warning" />
              Scadenze Imminenti
            </h2>
            <button
              className="text-xs text-primary font-bold hover:underline bg-transparent border-none cursor-pointer"
              onClick={() => onNavigate('/scadenze')}
            >
              Vedi tutte →
            </button>
          </div>
          {urgentDeadlines.length === 0 ? (
            <p className="text-text-dim text-xs py-8 text-center">Nessuna scadenza nei prossimi 7 giorni</p>
          ) : (
            <div className="space-y-2">
              {urgentDeadlines.slice(0, 5).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                  onClick={() => onSelectPractice(d.practiceId)}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.diffDays <= 1 ? 'bg-danger' : d.diffDays <= 3 ? 'bg-warning' : 'bg-info'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text truncate">{d.label}</p>
                    <p className="text-[10px] text-text-dim truncate">{d.client} — {d.object}</p>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted">{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fascicoli Recenti */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Briefcase size={16} className="text-primary" />
              Fascicoli Recenti
            </h2>
            <button className="btn-primary text-[10px] px-3 py-1" onClick={onNewPractice}>
              <Plus size={14} /> NUOVO
            </button>
          </div>
          {practices.length === 0 ? (
            <p className="text-text-dim text-xs py-8 text-center">Nessun fascicolo creato ancora</p>
          ) : (
            <div className="space-y-2">
              {activePractices.slice(0, 5).map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                  onClick={() => onSelectPractice(p.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text truncate">{p.client}</p>
                    <p className="text-[10px] text-text-dim truncate">{p.object}</p>
                  </div>
                  <ChevronRight size={14} className="text-text-dim group-hover:text-primary transition-all" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}