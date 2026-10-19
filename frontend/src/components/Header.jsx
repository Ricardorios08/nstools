import React, { useState, useEffect, useRef } from 'react';
import { Menu, Settings, LogOut, Sun, Moon, Users, ChevronRight, ChevronDown } from 'lucide-react';

const ROLES = [
  { value: 'superadmin',       label: 'Super Admin',      color: '#a855f7' },
  { value: 'admin',            label: 'Admin',            color: '#818cf8' },
  { value: 'conversor_editar', label: 'Conversor Editar', color: '#34d399' },
  { value: 'conversor_admin',  label: 'Conversor Admin',  color: '#38bdf8' },
  { value: 'conversor',        label: 'Conversor',        color: '#fbbf24' },
];

const Header = ({ user, onMenuToggle, onLogout, theme, onThemeToggle, onRoleChange, originalRole }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setRolesExpanded(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  const handleToggle = () => {
    setDropdownOpen(v => !v);
    if (dropdownOpen) setRolesExpanded(false);
  };

  const handleRoleSelect = (rol) => {
    onRoleChange(rol);
    setDropdownOpen(false);
    setRolesExpanded(false);
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    onLogout();
  };

  const isSimulating = originalRole && user?.rol !== originalRole;
  const currentRoleMeta = ROLES.find(r => r.value === user?.rol);

  return (
    <header className="header">
      {/* Left: hamburger + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="menu-toggle" onClick={onMenuToggle}>
          <Menu size={24} />
        </button>
        <div className="header-title">TOOLS - Conversor Bancario</div>
        {isSimulating && (
          <span className="role-sim-badge">
            👁️ simulando: {currentRoleMeta?.label ?? user?.rol}
          </span>
        )}
      </div>

      {/* Right: connections + settings */}
      <div className="header-right">
        {/* Settings button */}
        <div className="settings-wrapper" ref={dropdownRef}>
          <button
            className="settings-btn"
            onClick={handleToggle}
            title="Configuración"
            style={{ transform: dropdownOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          >
            <Settings size={18} />
          </button>

          {dropdownOpen && (
            <div className="settings-dropdown">
              {/* User info header */}
              <div className="settings-dropdown-header">
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'none', letterSpacing: 0 }}>
                  {user?.nombre_usuario}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: currentRoleMeta?.color ?? '#94a3b8',
                      display: 'inline-block', flexShrink: 0
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: currentRoleMeta?.color ?? 'var(--text-dim)' }}>
                    {currentRoleMeta?.label ?? user?.rol}
                  </span>
                </div>
              </div>

              {/* Theme toggle */}
              <button className="settings-menu-item" onClick={() => { onThemeToggle(); }}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                <span>{theme === 'light' ? 'Cambiar a Oscuro' : 'Cambiar a Claro'}</span>
              </button>

              {/* Role switcher — only superadmin */}
              {originalRole === 'superadmin' && (
                <>
                  <div className="settings-separator" />
                  <button
                    className="settings-menu-item"
                    onClick={() => setRolesExpanded(v => !v)}
                  >
                    <Users size={16} />
                    <span>Cambiar Rol</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.5, display: 'flex' }}>
                      {rolesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                  {rolesExpanded && (
                    <div className="role-submenu">
                      {ROLES.map(r => (
                        <button
                          key={r.value}
                          className={`role-option ${user?.rol === r.value ? 'active-role' : ''}`}
                          style={{ color: user?.rol === r.value ? r.color : undefined }}
                          onClick={() => handleRoleSelect(r.value)}
                        >
                          <span className="role-dot" style={{ background: r.color }} />
                          {r.label}
                          {user?.rol === r.value && (
                            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.7 }}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="settings-separator" />

              {/* Logout */}
              <button className="settings-menu-item danger" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
