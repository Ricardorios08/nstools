import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './views/Login';
import UserManagement from './views/UserManagement';
import Profile from './views/Profile';
import ConversorBancario from './views/ConversorBancario';
import AyudaConversor from './views/AyudaConversor';
import { API_URL } from './config';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('conversor');
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
          setView('conversor');
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
    setView('conversor');
  };

  const handleLogout = () => {
    localStorage.removeItem('nomade_token');
    localStorage.removeItem('nomade_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setOriginalRole(null);
    setView('conversor');
  };

  const handleRoleChange = (newRol) => {
    setUser(prev => ({ ...prev, rol: newRol }));
    setView('conversor');
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
          {view === 'profile' ? (
            <Profile user={user} />
          ) : view === 'ayuda_conversor' ? (
            <AyudaConversor />
          ) : view === 'users' ? (
            (user?.rol === 'superadmin' || user?.rol === 'admin' || user?.rol === 'conversor_editar') ? <UserManagement user={user} /> : <ConversorBancario user={user} />
          ) : (
            <ConversorBancario user={user} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
