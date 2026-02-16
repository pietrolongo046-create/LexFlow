import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  CalendarClock, 
  CalendarDays, 
  Settings, 
  Info,
  LogOut 
} from 'lucide-react';
import logoSrc from '../assets/logo.png';
import api from '../api';

const Icons = {
  Dashboard: () => <LayoutDashboard className="sidebar-icon" strokeWidth={2} />,
  Fascicoli: () => <Briefcase className="sidebar-icon" strokeWidth={2} />,
  Scadenze: () => <CalendarClock className="sidebar-icon" strokeWidth={2} />,
  Agenda: () => <CalendarDays className="sidebar-icon" strokeWidth={2} />,
  Settings: () => <Settings className="sidebar-icon" strokeWidth={2} />,
  LockVault: () => <LogOut className="sidebar-icon" strokeWidth={2} />,
  Logo: () => (
    <img 
      src={logoSrc} 
      alt="LexFlow" 
      className="sidebar-logo-svg no-drag" 
      style={{ width: '26px', height: '26px', objectFit: 'contain' }} 
    />
  )
};

export default function Sidebar({ version = '1.0', onLock }) {
  const [counts, setCounts] = useState({ practices: 0, deadlines: 0 });

  const load = async () => { 
    try { 
      const data = await api.getSummary(); 
      setCounts({ practices: data.activePractices, deadlines: data.urgentDeadlines });
    } catch {} 
  };

  useEffect(() => {
    load();
    window.addEventListener('app-data-changed', load);
    return () => window.removeEventListener('app-data-changed', load);
  }, []);

  return (
    <nav className="sidebar">
      <div className="sidebar-traffic-spacer drag-region" />
      
      <div className="sidebar-brand drag-region">
        <Icons.Logo />
        <span className="sidebar-title">LexFlow</span>
      </div>

      <div className="sidebar-content no-drag">
        <NavLink to="/" end className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Dashboard />
          <span>Dashboard</span>
        </NavLink>

        <div className="sidebar-section-label">Gestione</div>

        <NavLink to="/pratiche" className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Fascicoli />
          <span>Fascicoli</span>
          {counts.practices > 0 && <span className="sidebar-badge">{counts.practices}</span>}
        </NavLink>

        <NavLink to="/scadenze" className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Scadenze />
          <span>Scadenze</span>
          {counts.deadlines > 0 && (
            <span className="sidebar-badge" style={{ background: 'var(--danger)', color: 'white' }}>
              {counts.deadlines}
            </span>
          )}
        </NavLink>

        <NavLink to="/agenda" className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Icons.Agenda />
          <span>Agenda</span>
        </NavLink>
      </div>

      {/* Footer con Blocca Vault e Impostazioni */}
      <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
        
        <button 
          onClick={onLock} 
          className="sidebar-link text-danger/80 hover:text-danger hover:bg-danger/10 transition-colors no-drag w-[calc(100%-20px)] border-none bg-transparent cursor-pointer"
          style={{ marginBottom: '4px' }}
        >
          <Icons.LockVault />
          <span>Blocca Vault</span>
        </button>

        <NavLink 
          to="/settings" 
          className={({isActive}) => `sidebar-link no-drag${isActive ? ' active' : ''}`} 
          title="Impostazioni"
        >
          <Icons.Settings />
          <span>Impostazioni</span>
        </NavLink>
        
        <div className="no-drag" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '5px', 
          opacity: 0.3, 
          fontSize: '10px', 
          padding: '6px 18px' 
        }}>
          <Info size={10} />
          <span>v{version}</span>
        </div>
      </div>
    </nav>
  );
}