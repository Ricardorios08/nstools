import React from 'react';
import { 
  Database, 
  TrendingUp, 
  Scale, 
  Table, 
  ChevronRight, 
  Search,
  Compass
} from 'lucide-react';

const ExplorerDashboard = ({ setView }) => {
  const explorers = [
    {
      id: 'explorer',
      title: 'Explorador de Tablas',
      description: 'Explorá y buscá de forma directa dentro de las tablas de tus bases de datos conectadas.',
      icon: <Database size={32} style={{ color: '#60a5fa' }} />,
      color: '#60a5fa',
      badge: 'Básico',
      details: 'Visualización de esquemas, conteo de filas y escaneo rápido.'
    },
    {
      id: 'analytics',
      title: 'Explorador Analítico (BI)',
      description: 'Módulo dinámico para realizar cruces de múltiples motores, agrupaciones, gráficos y filtros lógicos avanzados.',
      icon: <TrendingUp size={32} style={{ color: '#818cf8' }} />,
      color: '#818cf8',
      badge: 'Avanzado',
      details: 'Consultas pesadas, gráficos de barra y torta dinámicos.'
    },
    {
      id: 'apremio_explorer',
      title: 'Explorador de Apremios',
      description: 'Buscador y visor especializado para el módulo legal y financiero de apremios tributarios.',
      icon: <Scale size={32} style={{ color: '#fbbf24' }} />,
      color: '#fbbf24',
      badge: 'Específico',
      details: 'Relaciones de deudas, juicios y cuentas corrientes asociadas.'
    },
    {
      id: 'boleto_explorer',
      title: 'Explorador de Boletos',
      description: 'Análisis detallado de boletos emitidos y su estado de cobro, consolidando datos clave.',
      icon: <Table size={32} style={{ color: '#34d399' }} />,
      color: '#34d399',
      badge: 'Específico',
      details: 'Visualización directa de liquidaciones por períodos.'
    }
  ];

  return (
    <div className="body-content" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* Header del Dashboard */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          marginBottom: '2rem', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
          paddingBottom: '1.5rem' 
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(129, 140, 248, 0.2) 0%, rgba(96, 165, 250, 0.2) 100%)',
            border: '1px solid rgba(129, 140, 248, 0.3)',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Compass size={32} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Dashboard Explorador
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-dim)', fontSize: '0.95rem' }}>
              Seleccioná uno de los módulos de exploración para iniciar tus consultas y análisis sobre el ecosistema de base de datos.
            </p>
          </div>
        </div>

        {/* Grid de Tarjetas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginTop: '1rem'
        }}>
          {explorers.map((explorer) => (
            <div 
              key={explorer.id}
              onClick={() => setView(explorer.id)}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                minHeight: '260px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = explorer.color;
                e.currentTarget.style.boxShadow = `0 12px 20px -5px rgba(0, 0, 0, 0.3), 0 0 15px -3px ${explorer.color}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
            >
              {/* Contenido Superior */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{
                    background: `${explorer.color}15`,
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${explorer.color}30`
                  }}>
                    {explorer.icon}
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '4px 8px',
                    borderRadius: '99px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-dim)'
                  }}>
                    {explorer.badge}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
                  {explorer.title}
                </h3>
                
                <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                  {explorer.description}
                </p>
              </div>

              {/* Pie de Tarjeta */}
              <div style={{ 
                borderTop: '1px solid rgba(255,255,255,0.05)', 
                paddingTop: '16px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: 'auto'
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  {explorer.details}
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: explorer.color,
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>
                  Ingresar
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default ExplorerDashboard;
