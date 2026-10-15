import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { 
  Database, Table, Search, RefreshCw, ArrowLeft, 
  Settings, Scale, Layers, History, FileText
} from 'lucide-react';

const ApremioTables = ({ setView }) => {
  const [activeTab, setActiveTab] = useState('paraapre');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'paraapre', label: 'Parámetros Globales', icon: Settings, color: '#3b82f6' },
    { id: 'instjudi', label: 'Instancias Judiciales', icon: Scale, color: '#10b981' },
    { id: 'escaapre', label: 'Escalas de Gastos', icon: Layers, color: '#f59e0b' },
    { id: 'instapre', label: 'Histórico Instancias', icon: History, color: '#ef4444' }
  ];

  const fetchData = async (tabId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/apremio-config/${tabId}`);
      setData(response.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  const filteredData = data.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setView('apremio_dashboard')}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-dim)',
            transition: 'all 0.2s'
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
        }}>
          <Table size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Configuración y Tablas
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0 }}>
            Visualización de parámetros, escalas e instancias de apremio
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        padding: '4px',
        background: 'var(--bg)',
        borderRadius: '12px',
        width: 'fit-content',
        border: '1px solid var(--border)'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--card)' : 'transparent',
                color: isActive ? tab.color : 'var(--text-dim)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        gap: '1rem'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Buscar en la tabla..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: '0.875rem'
            }}
          />
        </div>
        <button
          onClick={() => fetchData(activeTab)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Table Container */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: 'var(--card)', 
        borderRadius: '14px', 
        border: '1px solid var(--border)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-dim)' }}>
            <RefreshCw size={24} className="spin" style={{ marginRight: '10px' }} />
            Cargando datos...
          </div>
        ) : filteredData.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)' }}>
              <tr>
                {Object.keys(filteredData[0]).map(key => (
                  <th key={key} style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: 'var(--text-dim)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '2px solid var(--border)'
                  }}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {Object.values(row).map((val, j) => (
                    <td key={j} style={{ 
                      padding: '12px 16px', 
                      color: 'var(--text)',
                      fontFamily: typeof val === 'number' ? 'monospace' : 'inherit'
                    }}>
                      {val === null ? <em style={{ color: 'var(--text-dim)' }}>null</em> : String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <Database size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>No se encontraron registros</p>
          </div>
        )}
      </div>
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ApremioTables;
