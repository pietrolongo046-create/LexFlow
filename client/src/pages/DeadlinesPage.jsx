import React, { useState, useEffect } from 'react';
import { CalendarClock, ChevronRight, AlertTriangle, Clock, Sun, Sunrise, Moon, Sunset, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_LABELS = { civile: 'Civile', penale: 'Penale', amm: 'Amministrativo', stra: 'Stragiudiziale' };
const TYPE_BADGE = { civile: 'badge-civile', penale: 'badge-penale', amm: 'badge-amm', stra: 'badge-stra' };

export default function DeadlinesPage({ practices, onSelectPractice, settings }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [briefingMattina, setBriefingMattina] = useState(settings?.briefingMattina || '08:30');
  const [briefingPomeriggio, setBriefingPomeriggio] = useState(settings?.briefingPomeriggio || '14:30');
  const [briefingSera, setBriefingSera] = useState(settings?.briefingSera || '19:30');
  const [briefingDirty, setBriefingDirty] = useState(false);

  useEffect(() => {
    setBriefingMattina(settings?.briefingMattina || '08:30');
    setBriefingPomeriggio(settings?.briefingPomeriggio || '14:30');
    setBriefingSera(settings?.briefingSera || '19:30');
    setBriefingDirty(false);
  }, [settings]);

  const handleBriefingSave = async () => {
    try {
      const updated = { ...settings, briefingMattina, briefingPomeriggio, briefingSera };
      await window.api.saveSettings(updated);
      await window.api.syncNotificationSchedule({ briefingMattina, briefingPomeriggio, briefingSera });
      setBriefingDirty(false);
      toast.success('Orari briefing aggiornati');
    } catch (e) {
      toast.error('Errore nel salvataggio');
    }
  };

  const onBriefingChange = (setter) => (e) => { setter(e.target.value); setBriefingDirty(true); };

  // Collect all deadlines from active practices
  const allDeadlines = [];
  practices.filter(p => p.status === 'active').forEach(p => {
    (p.deadlines || []).forEach(d => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      const diff = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
      allDeadlines.push({ ...d, practiceId: p.id, client: p.client, object: p.object, type: p.type, diff });
    });
  });
  allDeadlines.sort((a, b) => new Date(a.date) - new Date(b.date));

  const pastDeadlines = allDeadlines.filter(d => d.diff < 0);
  const todayDeadlines = allDeadlines.filter(d => d.diff === 0);
  const weekDeadlines = allDeadlines.filter(d => d.diff > 0 && d.diff <= 7);
  const futureDeadlines = allDeadlines.filter(d => d.diff > 7);
  const next30 = allDeadlines.filter(d => d.diff > 0 && d.diff <= 30);

  const formatDate = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

  const DeadlineRow = ({ d }) => (
    <div
      className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-card-hover transition cursor-pointer group"
      onClick={() => onSelectPractice(d.practiceId)}
    >
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        d.diff < 0 ? 'bg-danger' : d.diff === 0 ? 'bg-warning' : d.diff <= 3 ? 'bg-warning' : 'bg-info'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text">{d.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-text-dim">{d.client}</span>
          <span className={`badge text-[8px] py-0 px-1 ${TYPE_BADGE[d.type]}`}>
            {TYPE_LABELS[d.type]}
          </span>
        </div>
      </div>
      <span className="text-[11px] text-text-dim">{formatDate(d.date)}</span>
      <ChevronRight size={14} className="text-text-dim group-hover:text-primary transition flex-shrink-0" />
    </div>
  );

  const Section = ({ title, items, color }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className={`text-xs font-semibold mb-2 ${color}`}>{title} ({items.length})</h3>
        <div className="space-y-1">
          {items.map((d, i) => <DeadlineRow key={i} d={d} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="main-content animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <CalendarClock size={22} className="text-warning" />
            Scadenze
          </h1>
          <p className="text-text-muted text-sm mt-0.5">{allDeadlines.length} scadenz{allDeadlines.length === 1 ? 'a' : 'e'} totali</p>
        </div>
      </div>

      {/* 3 Stat Cards + Briefing Widget */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* In Scadenza Oggi — muted red */}
        <div className="glass-card p-4 border-l-4 border-[#c94f4f]">
          <p className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">In Scadenza Oggi</p>
          <p className="text-3xl font-black text-[#c94f4f]">{todayDeadlines.length}</p>
          <p className="text-[10px] text-text-dim mt-1">
            {todayDeadlines.length === 0 ? 'Nessuna scadenza' : todayDeadlines.map(d => d.label).join(', ')}
          </p>
        </div>

        {/* In Ritardo — muted orange */}
        <div className="glass-card p-4 border-l-4 border-[#c27636]">
          <p className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">In Ritardo</p>
          <p className="text-3xl font-black text-[#c27636]">{pastDeadlines.length}</p>
          <p className="text-[10px] text-text-dim mt-1">
            {pastDeadlines.length === 0 ? 'Tutto in regola' : `${pastDeadlines.length} scadenz${pastDeadlines.length === 1 ? 'a' : 'e'} superat${pastDeadlines.length === 1 ? 'a' : 'e'}`}
          </p>
        </div>

        {/* Prossimi 30 giorni — muted green */}
        <div className="glass-card p-4 border-l-4 border-[#4a9c6d]">
          <p className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Prossimi 30 Giorni</p>
          <p className="text-3xl font-black text-[#4a9c6d]">{next30.length}</p>
          <p className="text-[10px] text-text-dim mt-1">
            {next30.length === 0 ? 'Calendario libero' : `${next30.length} in arrivo`}
          </p>
        </div>

        {/* Orari Briefing — EDITABILE */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-text-dim uppercase tracking-wider">Orari Briefing</p>
            {briefingDirty && (
              <button onClick={handleBriefingSave} className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary-hover transition-colors">
                <Check size={12} /> Salva
              </button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-text-muted">
                <Sunrise size={14} className="text-amber-400" /> Mattina
              </span>
              <input type="time" className="input-field bg-black/20 border-white/5 w-24 text-center text-xs py-1" value={briefingMattina} onChange={onBriefingChange(setBriefingMattina)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-text-muted">
                <Sun size={14} className="text-orange-400" /> Pomeriggio
              </span>
              <input type="time" className="input-field bg-black/20 border-white/5 w-24 text-center text-xs py-1" value={briefingPomeriggio} onChange={onBriefingChange(setBriefingPomeriggio)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-text-muted">
                <Moon size={14} className="text-sky-400" /> Sera
              </span>
              <input type="time" className="input-field bg-black/20 border-white/5 w-24 text-center text-xs py-1" value={briefingSera} onChange={onBriefingChange(setBriefingSera)} />
            </div>
          </div>
        </div>
      </div>

      {allDeadlines.length === 0 ? (
        <div className="text-center py-16">
          <CalendarClock size={40} className="text-text-dim mx-auto mb-3" />
          <p className="text-text-muted text-sm">Nessuna scadenza impostata</p>
        </div>
      ) : (
        <div className="glass-card p-5">
          <Section title="Scadute" items={pastDeadlines} color="text-danger" />
          <Section title="Oggi" items={todayDeadlines} color="text-warning" />
          <Section title="Prossimi 7 giorni" items={weekDeadlines} color="text-info" />
          <Section title="Future" items={futureDeadlines} color="text-text-muted" />
        </div>
      )}
    </div>
  );
}
