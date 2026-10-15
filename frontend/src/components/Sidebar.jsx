import React from 'react';
import { 
  LayoutDashboard, 
  Database, 
  FileText, 
  ChevronRight, 
  PanelLeftClose, 
  PanelLeftOpen, 
  User, 
  Search, 
  Scale, 
  Code, 
  Users, 
  LogOut, 
  UserCircle,
  ShieldCheck,
  TrendingUp,
  Table,
  ClipboardCheck,
  Calculator,
  Compass,
  FileSpreadsheet,
  HelpCircle
} from 'lucide-react';

const Sidebar = ({ currentView, setView, collapsed, setCollapsed, mobileOpen, setMobileOpen, user, onLogout }) => {
  const isAuditView = ['audit_module', 'dashboard', 'comparison', 'integrity', 'rubros', 'logs'].includes(currentView);
  const isCtacteView = ['ctacte_module', 'ctacte', 'ctacte_fn', 'ctacte2'].includes(currentView);
  const isConversorFamily = user?.rol === 'conversor' || user?.rol === 'conversor_editar' || user?.rol === 'conversor_admin';
  const isConversor = isConversorFamily; // oculta el resto del menú

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '10px 0' : '10px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/favicon.svg" alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          {!collapsed && <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Nomade</span>}
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
        {/* Items ocultos para rol conversor */}
        {!isConversor && (<>
        <div
          className={`menu-item ctacte ${isCtacteView ? 'active' : ''}`}
          onClick={() => setView((user?.rol === 'municipalidad' || user?.rol === 'usuario') ? 'ctacte_fn' : 'ctacte_module')}
          title={collapsed ? "Cuenta Corriente" : ""}
        >
          <Calculator size={20} />
          {!collapsed && <span>Cuenta Corriente</span>}
          {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
        </div>

        <div
          className={`menu-item boletos ${currentView === 'boletos' ? 'active' : ''}`}
          onClick={() => setView('boletos')}
          title={collapsed ? "Buscador Boletos" : ""}
        >
          <FileText size={20} />
          {!collapsed && <span>Buscador Boletos</span>}
          {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
        </div>

        {user?.rol === 'municipalidad' && (
          <div
            className={`menu-item rubros ${currentView === 'rubros' ? 'active' : ''}`}
            onClick={() => setView('rubros')}
            title={collapsed ? "Auditoría de Rubros" : ""}
          >
            <ClipboardCheck size={20} />
            {!collapsed && <span>Auditoría de Rubros</span>}
            {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </div>
        )}

        {(user?.rol === 'municipalidad' || user?.rol === 'usuario') && (
          <div
            className={`menu-item comparison ${currentView === 'comparison' ? 'active' : ''}`}
            onClick={() => setView('comparison')}
            title={collapsed ? "Comparativo Cta-cte" : ""}
          >
            <Table size={20} />
            {!collapsed && <span>Comparativo Cta-cte</span>}
            {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </div>
        )}

        {user?.rol !== 'municipalidad' && user?.rol !== 'usuario' && (
          <div
            className={`menu-item persona ${currentView === 'persona' ? 'active' : ''}`}
            onClick={() => setView('persona')}
            title={collapsed ? "Buscador Personas" : ""}
          >
            <User size={20} />
            {!collapsed && <span>Buscador Personas</span>}
            {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
          </div>
        )}

        {user?.rol !== 'municipalidad' && (
          <>
            <div
              className={`menu-item apremio ${['apremio_dashboard', 'apremios', 'gastos_apremio', 'gastos_apremio_real', 'apremio_individual', 'apremio_tables'].includes(currentView) ? 'active' : ''}`}
              onClick={() => setView('apremio_dashboard')}
              title={collapsed ? "Módulo de Apremio" : ""}
            >
              <Scale size={20} />
              {!collapsed && <span>Módulo de Apremio</span>}
              {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </div>

            <div
              className={`menu-item auditoria ${isAuditView ? 'active' : ''}`}
              onClick={() => setView('audit_module')}
              title={collapsed ? "Auditoría & Control" : ""}
            >
              <ClipboardCheck size={20} />
              {!collapsed && <span>Auditoría & Control</span>}
              {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </div>

            {(user?.rol === 'admin' || user?.rol === 'superadmin') && (
              <div
                className={`menu-item explorer ${['explorer_dashboard', 'explorer', 'analytics', 'apremio_explorer', 'boleto_explorer'].includes(currentView) ? 'active' : ''}`}
                onClick={() => setView('explorer_dashboard')}
                title={collapsed ? "Dashboard Explorador" : ""}
              >
                <Compass size={20} />
                {!collapsed && <span>Dashboard Explorador</span>}
                {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </div>
            )}

            {user?.rol === 'superadmin' && (
              <div
                className={`menu-item excel ${currentView === 'excel' ? 'active' : ''}`}
                onClick={() => setView('excel')}
                title={collapsed ? "Excel Comercios" : ""}
              >
                <FileText size={20} />
                {!collapsed && <span>Excel Comercios</span>}
                {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
              </div>
            )}

            <div className="sidebar-separator" style={{ height: '1px', background: 'var(--border)', margin: '1rem 0' }}></div>
          </>
        )}
        </>)} {/* fin !isConversor */}

        {/* Exclusivo para Superadmin */}
        {user?.rol === 'superadmin' && (
          <>
            <div
              className={`menu-item users ${currentView === 'users' ? 'active' : ''}`}
              onClick={() => setView('users')}
              title={collapsed ? "Usuarios" : ""}
            >
              <Users size={20} />
              {!collapsed && <span>Gestión Usuarios</span>}
              {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </div>

            <div
              className={`menu-item metabase ${currentView === 'metabase' ? 'active' : ''}`}
              onClick={() => setView('metabase')}
              title={collapsed ? "Reportes Metabase" : ""}
            >
              <TrendingUp size={20} />
              {!collapsed && <span>Reportes Metabase</span>}
              {!collapsed && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
            </div>
          </>
        )}

        {/* Conversor — visible para superadmin, conversor, conversor_editar, conversor_admin y municipalidad */}
        {(user?.rol === 'superadmin' || user?.rol === 'conversor' || user?.rol === 'conversor_editar' || user?.rol === 'conversor_admin' || user?.rol === 'municipalidad') && (
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
        )}

        {/* Gestión de usuarios — solo para conversor_editar (acceso restringido) */}
        {user?.rol === 'conversor_editar' && (
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

        {user?.rol !== 'municipalidad' && !isConversor && (
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
