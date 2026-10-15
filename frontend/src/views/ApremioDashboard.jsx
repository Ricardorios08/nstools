import React from 'react';
import { Scale, FileText, Database, ChevronRight, BookOpen, ArrowRight, Search, Calculator } from 'lucide-react';

const ApremioDashboard = ({ setView }) => {
  const cards = [
    {
      id: 'apremio_individual',
      title: 'Reporte Individual',
      description: 'Historial completo de un apremio, cronología de instancias judiciales y desglose de deuda.',
      icon: FileText,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      features: ['Historial instancias', 'Detalle de deuda', 'Estado judicial', 'Impresión de reporte']
    },
    {
      id: 'gastos_apremio_real',
      title: 'Calculadora Real de Gastos',
      description: 'Calculadora dinámica que utiliza los porcentajes y parámetros reales de la base de datos para simular liquidaciones.',
      icon: Calculator,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      features: ['Cálculo dinámico', 'Validación instjudi', 'Topes paraapre', 'Auditoría real']
    },
    {
      id: 'apremios',
      title: 'Panel de Apremios & Cédulas',
      description: 'Buscar y gestionar apremios activos, visualizar cédulas de notificación, instancias judiciales y estados.',
      icon: Scale,
      color: '#7c4dff',
      gradient: 'linear-gradient(135deg, #7c4dff 0%, #651fff 100%)',
      features: ['Búsqueda por padrón', 'Instancias judiciales', 'Estado de cédulas', 'Detalle del apremio']
    },
    {
      id: 'gastos_apremio',
      title: 'Gastos y Honorarios de Apremio',
      description: 'Análisis detallado de cómo se calculan los costos de apremio: comisiones, honorarios, movilidad, tasas de justicia y más.',
      icon: BookOpen,
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      features: ['Fórmula de cálculo', 'Parámetros vigentes', 'Tablas de configuración', 'Escalas y topes']
    },

    {
      id: 'apremio_search',
      title: 'Buscador de Paridad',
      description: 'Herramienta de auditoría para verificar si un apremio específico fue migrado correctamente y comparar sus saldos.',
      icon: Search,
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
      features: ['Búsqueda por ID', 'Comparación MariaDB/PG', 'Validación de saldos', 'Estado de migración']
    }
  ];

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
          background: 'linear-gradient(135deg, #7c4dff 0%, #651fff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)'
        }}>
          <Scale size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            Módulo de Apremio
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-dim)',
            margin: 0,
            marginTop: '2px'
          }}>
            Gestión de apremios, gastos, honorarios y parámetros de configuración
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

      {/* Info banner */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        borderLeft: '4px solid #7c4dff'
      }}>
        <Database size={20} color="#7c4dff" style={{ flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>
            Tablas involucradas
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>paraapre</code>{' · '}
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>instjudi</code>{' · '}
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>escaapre</code>{' · '}
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>instapre</code>{' · '}
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>boleapre</code>{' · '}
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>apremio</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApremioDashboard;
