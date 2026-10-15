import React from 'react';
import { 
  FileText, 
  Calculator, 
  Search,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

const CtacteModule = ({ setView, user }) => {
  const allCards = [
    {
      id: 'ctacte_fn',
      title: 'Cta-Cte (Fórmula Oficial)',
      description: 'Cálculo de deuda oficial utilizando la lógica de procedimiento almacenado (intereses de ley vigentes).',
      icon: Calculator,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      features: ['Backend Optimized', 'Intereses Automáticos', 'Vista Productiva']
    },
    {
      id: 'ctacte',
      title: 'Cta-Cte (Fórmula Alternativa)',
      description: 'Versión de prueba con motor de cálculo alternativo para validación de intereses y deuda histórica.',
      icon: FileText,
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      features: ['Cálculo Local', 'Fórmula de Prueba', 'Validación']
    },
    {
        id: 'ctacte2',
        title: 'Cta-Cte (Vista Simplificada)',
        description: 'Buscador alternativo con visualización optimizada para grandes volúmenes de datos.',
        icon: Search,
        color: '#10b981',
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        features: ['Búsqueda Rápida', 'Optimización SQL']
      }
  ];

  const cards = user?.rol === 'superadmin' 
    ? allCards 
    : allCards.filter(c => c.id === 'ctacte_fn');

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
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)'
        }}>
          <Calculator size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            Consultas de Cuenta Corriente
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-dim)',
            margin: 0,
            marginTop: '2px'
          }}>
            Seleccione el motor de cálculo y la vista deseada para consultar deuda y padrones.
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

      {/* Hint for different formulas - solo para superadmin */}
      {user?.rol === 'superadmin' && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '2rem'
        }}>
          <ShieldAlert size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>
              Nota sobre Intereses
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              La versión "Alternativa" utiliza un motor de cálculo basado en JavaScript, mientras que la "Oficial" delega el cálculo al procedimiento <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '4px' }}>fnDeuda</code> del servidor. Use ambas para validar discrepancias.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CtacteModule;
