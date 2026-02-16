import React, { useState } from 'react';
import {
  ArrowLeft, FolderOpen, FolderPlus, FileText, Plus, Check, Trash2, X,
  CalendarClock, ClipboardList, BookOpen, ChevronDown, ChevronUp, Archive, RotateCcw
} from 'lucide-react';
import { generatePracticePDF } from '../utils/pdfGenerator';
import toast from 'react-hot-toast';

const TYPE_LABELS = { civile: 'Civile', penale: 'Penale', amm: 'Amministrativo', stra: 'Stragiudiziale' };
const TYPE_BADGE = { civile: 'badge-civile', penale: 'badge-penale', amm: 'badge-amm', stra: 'badge-stra' };
const FIELD_LABELS = {
  civile:  { counterparty: 'Controparte',    court: 'Tribunale',   code: 'N. R.G.' },
  penale:  { counterparty: 'Parte Offesa',   court: 'Tribunale',   code: 'N. R.G.N.R.' },
  amm:     { counterparty: 'Amministrazione', court: 'TAR / CdS', code: 'N. Ricorso' },
  stra:    { counterparty: 'Controparte',    court: 'Sede',        code: 'Rif. Pratica' },
};

export default function PracticeDetail({ practice, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState('tasks');
  const [newTask, setNewTask] = useState('');
  const [newDiaryText, setNewDiaryText] = useState('');
  const [newDeadlineLabel, setNewDeadlineLabel] = useState('');
  const [newDeadlineDate, setNewDeadlineDate] = useState('');
  const [showClosedTasks, setShowClosedTasks] = useState(false);

  const labels = FIELD_LABELS[practice.type] || FIELD_LABELS.civile;

  const update = (changes) => onUpdate({ ...practice, ...changes });

  // === TASKS ===
  const addTask = () => {
    if (!newTask.trim()) return;
    const tasks = [...(practice.tasks || []), { id: Date.now(), text: newTask.trim(), done: false }];
    update({ tasks });
    setNewTask('');
  };
  const toggleTask = (id) => {
    const tasks = (practice.tasks || []).map(t => t.id === id ? { ...t, done: !t.done } : t);
    update({ tasks });
  };
  const deleteTask = (id) => {
    const tasks = (practice.tasks || []).filter(t => t.id !== id);
    update({ tasks });
  };

  // === DIARY ===
  const addDiary = () => {
    if (!newDiaryText.trim()) return;
    const diary = [{ date: new Date().toISOString(), text: newDiaryText.trim() }, ...(practice.diary || [])];
    update({ diary });
    setNewDiaryText('');
  };
  const deleteDiary = (idx) => {
    const diary = (practice.diary || []).filter((_, i) => i !== idx);
    update({ diary });
  };

  // === DEADLINES ===
  const addDeadline = () => {
    if (!newDeadlineLabel.trim() || !newDeadlineDate) return;
    const deadlines = [...(practice.deadlines || []), { date: newDeadlineDate, label: newDeadlineLabel.trim() }];
    deadlines.sort((a, b) => new Date(a.date) - new Date(b.date));
    update({ deadlines });
    setNewDeadlineLabel('');
    setNewDeadlineDate('');
  };
  const deleteDeadline = (idx) => {
    const deadlines = (practice.deadlines || []).filter((_, i) => i !== idx);
    update({ deadlines });
  };

  // === FOLDER ===
  const linkFolder = async () => {
    const folder = await window.api.selectFolder();
    if (folder) update({ folderPath: folder });
  };
  const openFolder = () => { if (practice.folderPath) window.api.openPath(practice.folderPath); };

  // === PDF ===
  const exportPDF = async () => {
    try {
      const doc = await generatePracticePDF(practice);
      const clientSafe = (practice.client || 'fascicolo').replace(/[^a-zA-Z0-9àèéìòù ]/g, '').trim().replace(/\s+/g, '_');
      const filePath = await window.api.showSaveDialog({
        defaultPath: `LexFlow_${clientSafe}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (filePath) {
        const uint8 = doc.output('arraybuffer');
        // jsPDF can't write to arbitrary path in sandboxed renderer, so use data URL workaround
        const blob = new Blob([uint8], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('PDF esportato');
      }
    } catch {
      toast.error('Errore esportazione PDF');
    }
  };

  // === STATUS ===
  const toggleStatus = () => {
    update({ status: practice.status === 'active' ? 'closed' : 'active' });
    toast.success(practice.status === 'active' ? 'Fascicolo archiviato' : 'Fascicolo riaperto');
  };

  const pendingTasks = (practice.tasks || []).filter(t => !t.done);
  const doneTasks = (practice.tasks || []).filter(t => t.done);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatDateShort = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

  const TABS = [
    { id: 'tasks', label: 'Attività', icon: ClipboardList, count: pendingTasks.length },
    { id: 'diary', label: 'Diario', icon: BookOpen, count: (practice.diary || []).length },
    { id: 'deadlines', label: 'Scadenze', icon: CalendarClock, count: (practice.deadlines || []).length },
  ];

  return (
    <div className="main-content animate-slide-up">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-text-muted hover:text-text transition text-sm"
        >
          <ArrowLeft size={16} /> Indietro
        </button>
        <div className="flex items-center gap-2">
          <button onClick={exportPDF} className="btn-ghost text-xs">
            <FileText size={14} /> PDF
          </button>
          {practice.folderPath ? (
            <button onClick={openFolder} className="btn-ghost text-xs">
              <FolderOpen size={14} /> Apri Cartella
            </button>
          ) : (
            <button onClick={linkFolder} className="btn-ghost text-xs">
              <FolderPlus size={14} /> Collega Cartella
            </button>
          )}
          <button onClick={toggleStatus} className={`text-xs ${practice.status === 'active' ? 'btn-ghost' : 'btn-primary'}`}>
            {practice.status === 'active' ? <><Archive size={14} /> Archivia</> : <><RotateCcw size={14} /> Riapri</>}
          </button>
        </div>
      </div>

      {/* Case header */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-lg font-bold text-text">{practice.client}</h1>
              <span className={`badge ${TYPE_BADGE[practice.type]}`}>
                {TYPE_LABELS[practice.type]}
              </span>
              <span className={`badge ${practice.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                {practice.status === 'active' ? 'Attivo' : 'Chiuso'}
              </span>
            </div>
            <p className="text-sm text-text-muted">{practice.object}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-[10px] text-text-dim uppercase tracking-wider">{labels.counterparty}</p>
            <p className="text-xs text-text mt-0.5">{practice.counterparty || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-dim uppercase tracking-wider">{labels.court}</p>
            <p className="text-xs text-text mt-0.5">{practice.court || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-dim uppercase tracking-wider">{labels.code}</p>
            <p className="text-xs text-text mt-0.5">{practice.code || '—'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-all border-b-2 -mb-[1px] ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              <Icon size={15} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-primary/15 text-primary' : 'bg-border text-text-dim'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="glass-card p-5">
        {/* ===== TASKS ===== */}
        {activeTab === 'tasks' && (
          <div>
            {/* Add task */}
            <div className="flex gap-2 mb-4">
              <input
                className="input-field flex-1"
                placeholder="Nuova attività..."
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
              />
              <button onClick={addTask} className="btn-primary px-3" disabled={!newTask.trim()}>
                <Plus size={16} />
              </button>
            </div>

            {/* Pending */}
            {pendingTasks.length === 0 && doneTasks.length === 0 && (
              <p className="text-text-dim text-xs text-center py-6">Nessuna attività. Aggiungine una sopra.</p>
            )}
            <div className="space-y-1">
              {pendingTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-background/50 transition group">
                  <button onClick={() => toggleTask(t.id)} className="w-5 h-5 rounded border border-border hover:border-primary transition flex items-center justify-center flex-shrink-0" />
                  <span className="text-sm text-text flex-1">{t.text}</span>
                  <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Done */}
            {doneTasks.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowClosedTasks(!showClosedTasks)}
                  className="flex items-center gap-2 text-xs text-text-dim hover:text-text-muted transition mb-2"
                >
                  {showClosedTasks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Completate ({doneTasks.length})
                </button>
                {showClosedTasks && (
                  <div className="space-y-1">
                    {doneTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-background/50 transition group opacity-60">
                        <button onClick={() => toggleTask(t.id)} className="w-5 h-5 rounded bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
                          <Check size={12} className="text-primary" />
                        </button>
                        <span className="text-sm text-text-muted flex-1 line-through">{t.text}</span>
                        <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== DIARY ===== */}
        {activeTab === 'diary' && (
          <div>
            {/* Add entry */}
            <div className="flex gap-2 mb-5">
              <textarea
                className="input-field flex-1"
                rows={2}
                placeholder="Nuova annotazione..."
                value={newDiaryText}
                onChange={e => setNewDiaryText(e.target.value)}
              />
              <button onClick={addDiary} className="btn-primary px-3 self-end" disabled={!newDiaryText.trim()}>
                <Plus size={16} />
              </button>
            </div>

            {/* Timeline */}
            {(practice.diary || []).length === 0 ? (
              <p className="text-text-dim text-xs text-center py-6">Nessuna annotazione.</p>
            ) : (
              <div className="space-y-0">
                {(practice.diary || []).map((entry, idx) => (
                  <div key={idx} className="flex gap-3 group">
                    <div className="flex flex-col items-center">
                      <div className="timeline-dot mt-1" />
                      {idx < (practice.diary || []).length - 1 && <div className="timeline-line flex-1 my-1" />}
                    </div>
                    <div className="pb-5 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-text-dim">{formatDate(entry.date)}</span>
                        <button
                          onClick={() => deleteDiary(idx)}
                          className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <p className="text-xs text-text leading-relaxed">{entry.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== DEADLINES ===== */}
        {activeTab === 'deadlines' && (
          <div>
            {/* Add deadline */}
            <div className="flex gap-2 mb-4">
              <input
                className="input-field flex-1"
                placeholder="Descrizione scadenza..."
                value={newDeadlineLabel}
                onChange={e => setNewDeadlineLabel(e.target.value)}
              />
              <input
                type="date"
                className="input-field w-40"
                value={newDeadlineDate}
                onChange={e => setNewDeadlineDate(e.target.value)}
              />
              <button
                onClick={addDeadline}
                className="btn-primary px-3"
                disabled={!newDeadlineLabel.trim() || !newDeadlineDate}
              >
                <Plus size={16} />
              </button>
            </div>

            {/* List */}
            {(practice.deadlines || []).length === 0 ? (
              <p className="text-text-dim text-xs text-center py-6">Nessuna scadenza impostata.</p>
            ) : (
              <div className="space-y-1">
                {(practice.deadlines || []).map((d, idx) => {
                  const dDate = new Date(d.date);
                  dDate.setHours(0, 0, 0, 0);
                  const diff = Math.ceil((dDate - today) / (1000 * 60 * 60 * 24));
                  const isPast = diff < 0;
                  const isToday = diff === 0;
                  const isUrgent = diff > 0 && diff <= 3;

                  return (
                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-background/50 transition group">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isPast ? 'bg-danger' : isToday ? 'bg-warning' : isUrgent ? 'bg-warning' : 'bg-info'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm text-text">{d.label}</p>
                        <p className="text-[10px] text-text-dim">{formatDate(d.date)}</p>
                      </div>
                      <span className={`text-[11px] font-semibold ${
                        isPast ? 'text-danger' : isToday ? 'text-warning' : isUrgent ? 'text-warning' : 'text-text-muted'
                      }`}>
                        {isPast ? `Scaduta (${Math.abs(diff)}g fa)` : isToday ? 'OGGI' : diff === 1 ? 'Domani' : `tra ${diff}g`}
                      </span>
                      <button
                        onClick={() => deleteDeadline(idx)}
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
