import React from 'react';
import { CalendarClock, ChevronRight } from 'lucide-react';

const TYPE_LABELS = { civile: 'Civile', penale: 'Penale', amm: 'Amministrativo', stra: 'Stragiudiziale' };
const TYPE_BADGE = { civile: 'badge-civile', penale: 'badge-penale', amm: 'badge-amm', stra: 'badge-stra' };

export default function DeadlinesPage({ practices, onSelectPractice }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <CalendarClock size={22} className="text-warning" />
          Scadenze
        </h1>
        <p className="text-text-muted text-sm mt-0.5">{allDeadlines.length} scadenz{allDeadlines.length === 1 ? 'a' : 'e'} totali</p>
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
