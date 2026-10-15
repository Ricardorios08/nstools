import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CuentaCorriente from './views/CuentaCorriente';
import CuentaCorrienteFn from './views/CuentaCorrienteFn';
import CuentaCorriente2 from './views/CuentaCorriente2';
import ComerciosExcel from './views/ComerciosExcel';
import PersonaSearch from './views/PersonaSearch';
import TableExplorer from './views/TableExplorer';
import Apremios from './views/Apremios';
import ComparisonReport from './views/ComparisonReport';
import AuditDashboard from './views/AuditDashboard';
import Login from './views/Login';
import UserManagement from './views/UserManagement';
import Profile from './views/Profile';
import LogViewer from './views/LogViewer';
import SnapshotAudit from './views/SnapshotAudit';
import BoletoSearch from './views/BoletoSearch';
import ApremioDashboard from './views/ApremioDashboard';
import GastosApremioReport from './views/GastosApremioReport';
import ApremioTables from './views/ApremioTables';
import ApremioSearch from './views/ApremioSearch';
import RubrosComparison from './views/RubrosComparison';
import GastosApremioReal from './views/GastosApremioReal';
import ApremioIndividualReport from './views/ApremioIndividualReport';
import BoletoExplorer from './views/BoletoExplorer';
import ApremioExplorer from './views/ApremioExplorer';
import AuditModule from './views/AuditModule';
import CtacteModule from './views/CtacteModule';
import AnalyticsExplorer from './views/AnalyticsExplorer';
import ExplorerDashboard from './views/ExplorerDashboard';
import MetabaseReports from './views/MetabaseReports';
import ConversorBancario from './views/ConversorBancario';
import AyudaConversor from './views/AyudaConversor';
import { API_URL } from './config';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('nomade_theme') || 'dark');
  const [originalRole, setOriginalRole] = useState(null);

  // Aplica la clase al body y guarda en localStorage (fallback rápido)
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('nomade_theme', theme);
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem('nomade_token');
    const savedUser = localStorage.getItem('nomade_user');
    
    if (token && savedUser) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token with backend
      axios.get(`${API_URL}/auth/me`)
        .then(res => {
          const userData = res.data.user;
          setUser(userData);
          setOriginalRole(userData.rol);
          // Aplicar tema guardado del usuario
          if (userData.theme) setTheme(userData.theme);
          if (userData.rol === 'municipalidad') {
            setView('ctacte_fn');
          } else if (userData.rol === 'conversor' || userData.rol === 'conversor_admin' || userData.rol === 'conversor_editar') {
            setView('conversor');
          }
        })
        .catch(err => {
          console.error('Invalid token', err);
          handleLogout();
        })
        .finally(() => {
          setCheckingAuth(false);
        });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setOriginalRole(userData.rol);
    // Aplicar tema guardado del usuario al hacer login
    if (userData.theme) setTheme(userData.theme);
    if (userData.rol === 'municipalidad') {
      setView('ctacte_fn');
    } else if (userData.rol === 'conversor' || userData.rol === 'conversor_admin' || userData.rol === 'conversor_editar') {
      setView('conversor');
    } else {
      setView('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nomade_token');
    localStorage.removeItem('nomade_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setOriginalRole(null);
    setView('dashboard');
  };

  const handleRoleChange = (newRol) => {
    setUser(prev => ({ ...prev, rol: newRol }));
    // Navigate to default view for that role
    if (newRol === 'municipalidad') setView('ctacte_fn');
    else if (newRol === 'conversor' || newRol === 'conversor_admin' || newRol === 'conversor_editar') setView('conversor');
    else setView('dashboard');
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    // Persistir en el servidor (best-effort, no bloquea)
    axios.put(`${API_URL}/auth/theme`, { theme: newTheme }).catch(() => {});
  };

  if (checkingAuth) {
    return <div className="loading-screen">Cargando...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`dashboard-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        currentView={view} 
        setView={(v) => { setView(v); setMobileMenuOpen(false); }} 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed} 
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
        user={user}
        onLogout={handleLogout}
      />
      <main className="main-content">
        <Header
          user={user}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          onLogout={handleLogout}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onRoleChange={handleRoleChange}
          originalRole={originalRole}
        />
        <div className={`body-content-wrapper${view === 'ayuda_conversor' ? ' scrollable' : ''}`}>
          {view === 'audit_module' ? (
            <AuditModule setView={setView} user={user} />
          ) : view === 'ctacte_module' ? (
            <CtacteModule setView={setView} user={user} />
          ) : view === 'dashboard' ? (
            <AuditDashboard />
          ) : view === 'ctacte' ? (
            <CuentaCorriente />
          ) : view === 'ctacte_fn' ? (
            <CuentaCorrienteFn user={user} />
          ) : view === 'ctacte2' ? (
            <CuentaCorriente2 />
          ) : view === 'persona' ? (
            <PersonaSearch />
          ) : view === 'explorer_dashboard' ? (
            <ExplorerDashboard setView={setView} />
          ) : view === 'explorer' ? (
            <TableExplorer />
          ) : view === 'analytics' ? (
            <AnalyticsExplorer />
          ) : view === 'apremio_dashboard' ? (
            <ApremioDashboard setView={setView} />
          ) : view === 'apremios' ? (
            <Apremios />
          ) : view === 'gastos_apremio' ? (
            <GastosApremioReport setView={setView} />
          ) : view === 'gastos_apremio_real' ? (
            <GastosApremioReal setView={setView} />
          ) : view === 'apremio_individual' ? (
            <ApremioIndividualReport />
          ) : view === 'apremio_tables' ? (
            <ApremioTables setView={setView} />
          ) : view === 'apremio_search' ? (
            <ApremioSearch />
          ) : view === 'comparison' ? (
            <ComparisonReport />
          ) : view === 'profile' ? (
            <Profile user={user} />
          ) : view === 'logs' ? (
            <LogViewer />
          ) : view === 'integrity' ? (
            <SnapshotAudit />
          ) : view === 'boletos' ? (
            <BoletoSearch currentUser={user} />
          ) : view === 'boleto_explorer' ? (
            <BoletoExplorer />
          ) : view === 'apremio_explorer' ? (
            <ApremioExplorer />
          ) : view === 'rubros' ? (
            <RubrosComparison />
          ) : view === 'excel' ? (
            user?.rol === 'superadmin' ? <ComerciosExcel /> : <AuditDashboard />
          ) : view === 'metabase' ? (
            user?.rol === 'superadmin' ? <MetabaseReports user={user} /> : <AuditDashboard />
          ) : view === 'conversor' ? (
            (user?.rol === 'superadmin' || user?.rol === 'conversor' || user?.rol === 'conversor_admin' || user?.rol === 'conversor_editar' || user?.rol === 'municipalidad') ? <ConversorBancario user={user} /> : <AuditDashboard />
          ) : view === 'ayuda_conversor' ? (
            (user?.rol === 'superadmin' || user?.rol === 'conversor' || user?.rol === 'conversor_admin' || user?.rol === 'conversor_editar' || user?.rol === 'municipalidad') ? <AyudaConversor /> : <AuditDashboard />
          ) : view === 'users' ? (
            (user?.rol === 'superadmin' || user?.rol === 'admin' || user?.rol === 'municipalidad' || user?.rol === 'conversor_editar') ? <UserManagement user={user} /> : <AuditDashboard />
          ) : (
            <AuditDashboard />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
