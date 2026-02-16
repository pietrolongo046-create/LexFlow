import React, { useState } from 'react';
import { X } from 'lucide-react';

const TYPES = [
  { id: 'civile', label: 'Civile', desc: 'Cause civili, risarcimenti, contratti' },
  { id: 'penale', label: 'Penale', desc: 'Procedimenti penali, difesa' },
  { id: 'amm', label: 'Amministrativo', desc: 'TAR, Consiglio di Stato, PA' },
  { id: 'stra', label: 'Stragiudiziale', desc: 'Mediazioni, negoziazioni, pareri' },
];

const TYPE_BADGE = { civile: 'badge-civile', penale: 'badge-penale', amm: 'badge-amm', stra: 'badge-stra' };

// Adaptive labels per type
const FIELD_LABELS = {
  civile:  { counterparty: 'Controparte',    court: 'Tribunale',   code: 'N. R.G.' },
  penale:  { counterparty: 'Parte Offesa',   court: 'Tribunale',   code: 'N. R.G.N.R.' },
  amm:     { counterparty: 'Amministrazione', court: 'TAR / CdS', code: 'N. Ricorso' },
  stra:    { counterparty: 'Controparte',    court: 'Sede',        code: 'Rif. Pratica' },
};

export default function CreatePracticeModal({ onClose, onSave }) {
  const [type, setType] = useState('');
  const [form, setForm] = useState({
    client: '', counterparty: '', court: '', object: '', code: '',
  });

  const labels = FIELD_LABELS[type] || FIELD_LABELS.civile;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!type || !form.client || !form.object) return;

    const practice = {
      id: Date.now(),
      type,
      ...form,
      status: 'active',
      folderPath: '',
      tasks: [],
      diary: [],
      deadlines: [],
      createdAt: new Date().toISOString(),
    };
    onSave(practice);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text">Nuovo Fascicolo</h2>
          <button onClick={onClose} className="text-text-dim hover:text-text transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          {!type ? (
            <div>
              <label className="text-xs text-text-muted mb-2 block">Tipo di procedimento</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className="p-3 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition text-left group"
                  >
                    <span className={`badge text-[10px] ${TYPE_BADGE[t.id]} mb-1`}>{t.label}</span>
                    <p className="text-[10px] text-text-dim group-hover:text-text-muted transition">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Type badge + change */}
              <div className="flex items-center justify-between">
                <span className={`badge ${TYPE_BADGE[type]}`}>
                  {TYPES.find(t => t.id === type)?.label}
                </span>
                <button
                  type="button"
                  onClick={() => setType('')}
                  className="text-[11px] text-primary hover:text-primary-hover transition"
                >
                  Cambia tipo
                </button>
              </div>

              {/* Fields */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Cliente / Assistito *</label>
                <input
                  className="input-field"
                  placeholder="es. Mario Rossi"
                  value={form.client}
                  onChange={e => setForm({ ...form, client: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-text-muted mb-1 block">{labels.counterparty}</label>
                <input
                  className="input-field"
                  placeholder={`es. ${type === 'amm' ? 'Comune di Roma' : 'Allianz SPA'}`}
                  value={form.counterparty}
                  onChange={e => setForm({ ...form, counterparty: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">{labels.court}</label>
                  <input
                    className="input-field"
                    placeholder={`es. ${type === 'amm' ? 'TAR Lazio' : 'Trib. Roma'}`}
                    value={form.court}
                    onChange={e => setForm({ ...form, court: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">{labels.code}</label>
                  <input
                    className="input-field"
                    placeholder="es. 123/2024"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-text-muted mb-1 block">Oggetto *</label>
                <input
                  className="input-field"
                  placeholder="es. Sinistro stradale / Impugnazione sentenza"
                  value={form.object}
                  onChange={e => setForm({ ...form, object: e.target.value })}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-ghost">
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!form.client || !form.object}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Crea Fascicolo
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
