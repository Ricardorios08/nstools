import React from 'react';
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Users, LogOut, UserCircle, FileSpreadsheet, HelpCircle } from 'lucide-react';

const Sidebar = ({ currentView, setView, collapsed, setCollapsed, mobileOpen, setMobileOpen, user, onLogout }) => {
  const isConversor = user?.rol === 'conversor' || user?.rol === 'conversor_editar' || user?.rol === 'conversor_admin';
  const canManageUsers = user?.rol === 'superadmin' || user?.rol === 'admin' || user?.rol === 'conversor_editar';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '10px 0' : '10px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/favicon.svg" alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          {!collapsed && <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>TOOLS Conversor</span>}
        </div>
        <button
          className="collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="sidebar-menu">
        {/* Conversor — visible para superadmin, conversor, conversor_editar, conversor_admin */}
          <>
            <div
              className={`menu-item conversor ${currentView === 'conversor' ? 'active' : ''}`}
              onClick={() => setView('conversor')}
              title={collapsed ? "Conversor Bancario" : ""}
            >
              <FileSpreadsheet size={20} />
              {!collapsed && <span>Conversor Bancario</span>}
              {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </div>
            <div
              className={`menu-item ayuda-conversor ${currentView === 'ayuda_conversor' ? 'active' : ''}`}
              onClick={() => setView('ayuda_conversor')}
              title={collapsed ? "Ayuda del Conversor" : ""}
            >
              <HelpCircle size={20} />
              {!collapsed && <span>Ayuda del Conversor</span>}
              {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </div>
          </>

        {canManageUsers && (
          <div
            className={`menu-item users ${currentView === 'users' ? 'active' : ''}`}
            onClick={() => setView('users')}
            title={collapsed ? 'Gestión Usuarios' : ''}
          >
            <Users size={20} />
            {!collapsed && <span>Gestión Usuarios</span>}
            {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </div>
        )}

        {!isConversor && (
          <div
            className={`menu-item profile ${currentView === 'profile' ? 'active' : ''}`}
            onClick={() => setView('profile')}
            title={collapsed ? "Mi Perfil" : ""}
          >
            <UserCircle size={20} />
            {!collapsed && <span>Mi Perfil</span>}
            {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </div>
        )}

        <div
          className="menu-item logout logout-item"
          onClick={onLogout}
          title={collapsed ? "Cerrar Sesión" : ""}
          style={{ marginTop: 'auto' }}
        >
          <LogOut size={20} />
          {!collapsed && <span>Cerrar Sesión</span>}
        </div>
      </nav>

      {!collapsed && (
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            Usuario: <span style={{ fontWeight: 600 }}>{user?.nombre_usuario}</span>
          </p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
