import React from 'react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  Database,
  ArrowRight,
  ClipboardCheck
} from 'lucide-react';

const AuditModule = ({ setView, user }) => {
  const cards = [
    {
      id: 'dashboard',
      title: 'Dashboard de Control',
      description: 'Panel ejecutivo con métricas de recaudación, comparación de deuda total y estados de conexión entre motores.',
      icon: LayoutDashboard,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      features: ['Totales de Deuda', 'Estado de Sync', 'Métricas Globales']
    },
    {
      id: 'comparison',
      title: 'Comparativo de Listados',
      description: 'Herramienta de auditoría para comparar registros de Cta-Cte entre MariaDB y PostgreSQL con detalle de diferencias.',
      icon: FileText,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      features: ['Diferencias de Saldo', 'Reportes PDF', 'Exportación Excel']
    },
    {
      id: 'rubros',
      title: 'Auditoría de Rubros',
      description: 'Validación de actividades comerciales: comparación de rubros activos, fechas de alta y valores de UTM entre sistemas.',
      icon: TrendingUp,
      color: '#a855f7',
      gradient: 'linear-gradient(135deg, #a855f7 0%, #7c4dff 100%)',
      features: ['Principales vs Secundarias', 'Valores de UTM', 'Fechas de Vigencia']
    },
    {
      id: 'integrity',
      title: 'Snapshots de Integridad',
      description: 'Proceso de auditoría masiva que genera fotos del estado de deuda para detectar inconsistencias en el tiempo.',
      icon: ShieldCheck,
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      features: ['Regeneración Histórica', 'Filtro por Oficina', 'Control de Saldo']
    },
    {
      id: 'logs',
      title: 'Auditoría de Sistema',
      description: 'Registro histórico de operaciones realizadas por los usuarios y logs técnicos del servidor de migración.',
      icon: Database,
      color: '#64748b',
      gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
      features: ['Logs de SQL', 'Acceso de Usuarios', 'Eventos Críticos']
    }
  ].filter(card => {
    // Si es rol 'usuario', ocultar integridad, comparativo y auditoría de sistema (logs)
    if (user?.rol === 'usuario') {
      if (['integrity', 'comparison', 'logs'].includes(card.id)) {
        return false;
      }
    }
    // Si es rol 'admin', ocultar únicamente integridad y comparativo
    if (user?.rol === 'admin') {
      if (['integrity', 'comparison'].includes(card.id)) {
        return false;
      }
    }
    // El rol 'superadmin' ve absolutamente todo
    return true;
  });

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{
        marginBottom: '2.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
        }}>
          <ClipboardCheck size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            Módulo de Auditoría & Control
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-dim)',
            margin: 0,
            marginTop: '2px'
          }}>
            Validación de integridad de datos, comparación entre motores y seguimiento de cambios.
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => setView(card.id)}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.75rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 40px ${card.color}22`;
                e.currentTarget.style.borderColor = card.color + '44';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              {/* Decorative gradient stripe */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: card.gradient,
                borderRadius: '16px 16px 0 0'
              }} />

              {/* Icon + Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: card.color + '18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={22} color={card.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    margin: 0
                  }}>
                    {card.title}
                  </h3>
                </div>
                <ArrowRight size={18} color={card.color} style={{ opacity: 0.6 }} />
              </div>

              {/* Description */}
              <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-dim)',
                margin: '0 0 1.25rem 0',
                lineHeight: 1.6
              }}>
                {card.description}
              </p>

              {/* Feature tags */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                {card.features.map((feat, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: card.color + '12',
                      color: card.color,
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase'
                    }}
                  >
                    {feat}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AuditModule;
