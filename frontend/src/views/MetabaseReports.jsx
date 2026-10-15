import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { 
  TrendingUp, 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Settings, 
  Layout, 
  Database, 
  Info, 
  RefreshCw,
  Eye
} from 'lucide-react';

const MetabaseReports = ({ user }) => {
  const [dashboards, setDashboards] = useState([]);
  const [selectedDb, setSelectedDb] = useState(null);
  const [iframeUrl, setIframeUrl] = useState('');
  const [loadingIframe, setLoadingIframe] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modales y Gestión (CRUD)
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingDb, setEditingDb] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metabase_id: '',
    type: 'dashboard'
  });
  
  // SSO State
  const [ssoLoading, setSsoLoading] = useState(false);

  // Searchable Select State
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDashboards();
  }, []);

  useEffect(() => {
    if (selectedDb) {
      loadIframeUrl(selectedDb.id);
    } else {
      setIframeUrl('');
    }
  }, [selectedDb]);

  const fetchDashboards = async () => {
    setLoadingList(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`${API_URL}/metabase/dashboards`);
      setDashboards(res.data);
      if (res.data.length > 0 && !selectedDb) {
        setSelectedDb(res.data[0]);
      }
    } catch (err) {
      console.error('Error fetching Metabase dashboards:', err);
      const details = err.message ? ` [Detalle: ${err.message} - URL: ${err.config?.url || 'N/D'}]` : '';
      setErrorMsg((err.response?.data?.error || 'Error al conectar con el servidor.') + details);
    } finally {
      setLoadingList(false);
    }
  };

  const loadIframeUrl = async (id) => {
    setLoadingIframe(true);
    setIframeUrl('');
    setErrorMsg('');
    try {
      const res = await axios.get(`${API_URL}/metabase/iframe-url/${id}`);
      setIframeUrl(res.data.iframeUrl);
    } catch (err) {
      console.error('Error loading iframe url:', err);
      setErrorMsg(
        err.response?.data?.error || 
        'Error al firmar el token de seguridad para el tablero seleccionado.'
      );
    } finally {
      setLoadingIframe(false);
    }
  };

  const handleLaunchSSO = async () => {
    setSsoLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`${API_URL}/metabase/sso-url`);
      if (res.data.ssoUrl) {
        window.open(res.data.ssoUrl, '_blank');
      }
    } catch (err) {
      console.error('Error launching SSO:', err);
      setErrorMsg(
        err.response?.data?.error || 
        'No se pudo conectar con Metabase.'
      );
    } finally {
      setSsoLoading(false);
    }
  };

  const handleSaveDashboard = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.metabase_id) return;

    try {
      if (editingDb) {
        await axios.put(`${API_URL}/metabase/dashboards/${editingDb.id}`, formData);
      } else {
        await axios.post(`${API_URL}/metabase/dashboards`, formData);
      }
      setFormData({ name: '', description: '', metabase_id: '', type: 'dashboard' });
      setEditingDb(null);
      fetchDashboards();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar el tablero.');
    }
  };

  const handleDeleteDashboard = async (id) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este tablero registrado?')) return;
    try {
      await axios.delete(`${API_URL}/metabase/dashboards/${id}`);
      if (selectedDb?.id === id) {
        setSelectedDb(null);
      }
      fetchDashboards();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el tablero.');
    }
  };

  const handleEditClick = (db) => {
    setEditingDb(db);
    setFormData({
      name: db.name,
      description: db.description || '',
      metabase_id: db.metabase_id,
      type: db.type || 'dashboard'
    });
  };

  return (
    <div className="body-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* HEADER SECTION */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp style={{ color: 'var(--primary)' }} />
            Centro de Reportes Metabase
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
            Crea, administra y visualiza tableros interactivos e informes dinámicos de manera visual.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Custom Searchable Select */}
          {dashboards.length > 0 && (
            <div style={{ position: 'relative', minWidth: '260px', zIndex: 10 }}>
              <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  color: 'white',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  userSelect: 'none'
                }}
              >
                <span>{selectedDb ? selectedDb.name : 'Seleccionar Reporte...'}</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <>
                  <div 
                    onClick={() => setIsOpen(false)} 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.5rem',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    zIndex: 100,
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <input 
                      type="text"
                      placeholder="Buscar reporte..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.25rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: 'white',
                        fontSize: '0.85rem',
                        outline: 'none',
                        width: '100%'
                      }}
                      autoFocus
                    />
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {dashboards.filter(db => db.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                        <div style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                          No se encontraron reportes
                        </div>
                      ) : (
                        dashboards
                          .filter(db => db.name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(db => (
                            <div
                              key={db.id}
                              onClick={() => {
                                setSelectedDb(db);
                                setIsOpen(false);
                                setSearchTerm('');
                              }}
                              style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                backgroundColor: selectedDb?.id === db.id ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                                color: selectedDb?.id === db.id ? '#60a5fa' : 'white',
                                transition: 'background-color 0.2s',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <span>{db.name}</span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{db.type === 'dashboard' ? 'Dashboard' : 'Pregunta'}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button 
            className="btn btn-secondary" 
            onClick={() => setShowManageModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Settings size={16} />
            Administrar Reportes
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={handleLaunchSSO}
            disabled={ssoLoading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              borderColor: 'transparent',
              boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
            }}
          >
            {ssoLoading ? (
              <RefreshCw size={16} className="spin-animation" />
            ) : (
              <ExternalLink size={16} />
            )}
            Crear Reportes (Metabase SSO)
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE ALERTS */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#fca5a5',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start'
        }}>
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: '600' }}>Atención Técnica</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#fca5a5' }}>
              {errorMsg}. Asegúrate de que las variables de entorno `METABASE_SECRET_KEY` y `METABASE_SITE_URL` estén configuradas adecuadamente en el backend `.env`.
            </p>
          </div>
        </div>
      )}

      {/* CORE WORKSPACE */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        gap: '1.5rem',
        minHeight: '450px',
        height: 'calc(100vh - 220px)',
        overflow: 'hidden'
      }}>
        
        {/* DETAILED CONTENT: IFRAME CONTAINER */}
        <div style={{
          flex: 1,
          background: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {selectedDb ? (
            <>
              {/* Active Tab bar info */}
              <div style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(15, 23, 42, 0.4)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Visualizando {selectedDb.type || 'Tablero'}
                  </span>
                  <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '600' }}>{selectedDb.name}</h2>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', background: 'var(--glass)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  ID Metabase: {selectedDb.metabase_id}
                </div>
              </div>

              {/* Iframe area */}
              <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
                {loadingIframe && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--card-bg)',
                    zIndex: 10
                  }}>
                    <RefreshCw className="spin-animation" size={32} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Firmando sesión segura con Metabase...</p>
                  </div>
                )}
                
                {iframeUrl ? (
                  <iframe
                    src={iframeUrl}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      backgroundColor: 'transparent'
                    }}
                    title={selectedDb.name}
                    allowFullScreen
                  />
                ) : (
                  !loadingIframe && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
                      No se pudo cargar la vista del tablero. Verifique la configuración.
                    </div>
                  )
                )}
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--text-dim)'
            }}>
              <Database size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <h3>Ningún tablero seleccionado</h3>
              <p style={{ maxWidth: '400px', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Selecciona un reporte dinámico de la lista de la izquierda o crea uno nuevo usando el creador de Metabase.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CRUD / MANAGE MODAL */}
      {showManageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px', maxWidth: '95%' }}>
            
            <div className="modal-header">
              <h2>Administración de Reportes Registrados</h2>
              <button className="close-btn" onClick={() => {
                setShowManageModal(false);
                setEditingDb(null);
                setFormData({ name: '', description: '', metabase_id: '', type: 'dashboard' });
              }}>
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              
              {/* Form Side */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--border)', paddingRight: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>
                  {editingDb ? 'Editar Reporte' : 'Registrar Nuevo Reporte'}
                </h3>
                
                <form onSubmit={handleSaveDashboard} className="login-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div className="form-group">
                    <label>Nombre del Reporte</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Ej. Reporte General de Apremio"
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Descripción</label>
                    <textarea 
                      className="input-field" 
                      placeholder="Breve descripción del contenido"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      style={{ minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>ID Metabase</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder="Ej: 15"
                        value={formData.metabase_id} 
                        onChange={(e) => setFormData({ ...formData, metabase_id: e.target.value })} 
                        required 
                      />
                    </div>
                    
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Tipo de Recurso</label>
                      <select 
                        className="input-field"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      >
                        <option value="dashboard">Dashboard</option>
                        <option value="question">Pregunta (Gráfico/Tabla)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      {editingDb ? 'Guardar Cambios' : 'Registrar'}
                    </button>
                    {editingDb && (
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={() => {
                          setEditingDb(null);
                          setFormData({ name: '', description: '', metabase_id: '', type: 'dashboard' });
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Table Side */}
              <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Listado de Registros</h3>
                
                <div style={{ overflowY: 'auto', maxHeight: '350px', border: '1px solid var(--border)', borderRadius: '6px' }}>
                  <table className="user-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th style={{ width: '80px' }}>MB ID</th>
                        <th style={{ width: '120px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboards.length === 0 ? (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                            No hay reportes registrados.
                          </td>
                        </tr>
                      ) : (
                        dashboards.map((db) => (
                          <tr key={db.id}>
                            <td style={{ fontSize: '0.85rem' }}>
                              <strong>{db.name}</strong>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{db.type}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{db.metabase_id}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button 
                                  onClick={() => handleEditClick(db)} 
                                  className="btn" 
                                  style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.05)', color: '#60a5fa' }}
                                  title="Editar"
                                >
                                  <Edit size={12} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteDashboard(db.id)} 
                                  className="delete-btn" 
                                  style={{ padding: '0.25rem 0.5rem' }}
                                  title="Eliminar"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* CSS Animation local injection */}
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .metabase-item:hover {
          background-color: rgba(255, 255, 255, 0.04);
        }
      `}</style>

    </div>
  );
};

export default MetabaseReports;
