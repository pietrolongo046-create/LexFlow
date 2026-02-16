import React, { useState } from 'react';
import { Plus, Search, Briefcase, Filter } from 'lucide-react';

const TYPE_LABELS = { civile: 'Civile', penale: 'Penale', amm: 'Amministrativo', stra: 'Stragiudiziale' };
const TYPE_BADGE = { civile: 'badge-civile', penale: 'badge-penale', amm: 'badge-amm', stra: 'badge-stra' };

export default function PracticesList({ practices, onSelect, onNewPractice }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = practices.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.client?.toLowerCase().includes(q) ||
        p.counterparty?.toLowerCase().includes(q) ||
        p.object?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.court?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingTasksCount = (p) => (p.tasks || []).filter(t => !t.done).length;
  const nextDeadline = (p) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = (p.deadlines || [])
      .map(d => ({ ...d, dateObj: new Date(d.date) }))
      .filter(d => d.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj);
    return upcoming[0] || null;
  };

  return (
    <div className="main-content animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text">Fascicoli</h1>
          <p className="text-text-muted text-sm mt-0.5">{practices.length} fascicol{practices.length === 1 ? 'o' : 'i'} totali</p>
        </div>
        <button className="btn-primary" onClick={onNewPractice}>
          <Plus size={16} /> Nuovo Fascicolo
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className="input-field pl-9"
            placeholder="Cerca per cliente, oggetto, codice..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-40"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="all">Tutti i tipi</option>
          <option value="civile">Civile</option>
          <option value="penale">Penale</option>
          <option value="amm">Amministrativo</option>
          <option value="stra">Stragiudiziale</option>
        </select>
        <select
          className="input-field w-36"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">Tutti</option>
          <option value="active">Attivi</option>
          <option value="closed">Chiusi</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={40} className="text-text-dim mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            {practices.length === 0 ? 'Nessun fascicolo ancora' : 'Nessun risultato'}
          </p>
          {practices.length === 0 && (
            <button className="btn-primary mt-4 text-sm" onClick={onNewPractice}>
              <Plus size={14} /> Crea il primo fascicolo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const pending = pendingTasksCount(p);
            const deadline = nextDeadline(p);
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="glass-card p-4 cursor-pointer hover:border-primary/20 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-text">{p.client}</span>
                        <span className={`badge text-[9px] py-0.5 px-1.5 ${TYPE_BADGE[p.type]}`}>
                          {TYPE_LABELS[p.type]}
                        </span>
                        <span className={`badge text-[9px] py-0.5 px-1.5 ${p.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                          {p.status === 'active' ? 'Attivo' : 'Chiuso'}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">{p.object}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-text-dim">
                        {p.court && <span>{p.court}</span>}
                        {p.code && <span>{p.code}</span>}
                        {p.counterparty && <span>vs {p.counterparty}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] flex-shrink-0">
                    {pending > 0 && (
                      <span className="text-info">{pending} attività</span>
                    )}
                    {deadline && (
                      <span className="text-warning">{new Date(deadline.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
