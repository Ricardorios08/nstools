import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import {
  BookOpen, ArrowLeft, Database, Calculator, AlertTriangle,
  ChevronDown, ChevronUp, FileText, Scale, Info, Zap, Search, RefreshCw,
  Settings, Layers, History, Table
} from 'lucide-react';

const Section = ({ title, icon: Icon, color, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      overflow: 'hidden',
      marginBottom: '1rem'
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          transition: 'background 0.2s',
          userSelect: 'none'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: color + '18', display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', flex: 1 }}>{title}</span>
        {open ? <ChevronUp size={16} color="var(--text-dim)" /> : <ChevronDown size={16} color="var(--text-dim)" />}
      </div>
      {open && (
        <div style={{ padding: '1.25rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const DataTable = ({ headers, rows, highlightCol }) => (
  <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: '10px 14px',
              textAlign: 'left',
              background: 'var(--bg)',
              color: 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: '1px solid var(--border)',
              whiteSpace: 'nowrap'
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {row.map((cell, ci) => (
              <td key={ci} style={{
                padding: '9px 14px',
                color: ci === highlightCol ? '#f59e0b' : 'var(--text)',
                fontWeight: ci === highlightCol ? 600 : 400,
                fontFamily: typeof cell === 'number' || (typeof cell === 'string' && cell.startsWith('$')) ? 'monospace' : 'inherit',
                whiteSpace: 'nowrap'
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Alert = ({ type = 'info', children }) => {
  const colors = {
    info: { bg: '#3b82f620', border: '#3b82f6', icon: Info, text: '#3b82f6' },
    warning: { bg: '#f59e0b18', border: '#f59e0b', icon: AlertTriangle, text: '#f59e0b' },
    important: { bg: '#7c4dff18', border: '#7c4dff', icon: Zap, text: '#7c4dff' }
  };
  const c = colors[type];
  const Icon = c.icon;
  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}33`,
      borderLeft: `4px solid ${c.border}`,
      borderRadius: '10px',
      padding: '0.9rem 1.1rem',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'flex-start',
      marginBottom: '1rem'
    }}>
      <Icon size={16} color={c.text} style={{ marginTop: '2px', flexShrink: 0 }} />
      <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
};

const CodeBlock = ({ children }) => (
  <pre style={{
    background: '#0d1117',
    color: '#c9d1d9',
    padding: '1rem 1.25rem',
    borderRadius: '10px',
    fontSize: '0.78rem',
    lineHeight: 1.7,
    overflow: 'auto',
    border: '1px solid #30363d',
    marginBottom: '1rem',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
  }}>
    <code>{children}</code>
  </pre>
);

const Tag = ({ color, children }) => (
  <code style={{
    background: color ? color + '18' : 'var(--bg)',
    color: color || 'var(--text)',
    padding: '2px 7px',
    borderRadius: '5px',
    fontSize: '0.75rem',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace"
  }}>{children}</code>
);

const GastosApremioReport = ({ setView }) => {
  const [liveParams, setLiveParams] = useState(null);
  const [liveInstjudi, setLiveInstjudi] = useState(null);

  // States and configuration for the integrated DB Tables Explorer
  const [activeTab, setActiveTab] = useState('paraapre');
  const [tableData, setTableData] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'paraapre', label: 'Parámetros Globales', icon: Settings, color: '#3b82f6' },
    { id: 'instjudi', label: 'Instancias Judiciales', icon: Scale, color: '#10b981' },
    { id: 'escaapre', label: 'Escalas de Gastos', icon: Layers, color: '#f59e0b' },
    { id: 'instapre', label: 'Histórico Instancias', icon: History, color: '#ef4444' }
  ];

  const fetchTableData = async (tabId) => {
    setTableLoading(true);
    try {
      const response = await axios.get(`${API_URL}/apremio-config/${tabId}`);
      setTableData(response.data);
    } catch (err) {
      console.error('Error fetching table data:', err);
      setTableData([]);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData(activeTab);
  }, [activeTab]);

  const filteredData = tableData.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paramsRes, instjudiRes] = await Promise.all([
          axios.get(`${API_URL}/apremio-config/paraapre`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/apremio-config/instjudi`).catch(() => ({ data: [] }))
        ]);
        setLiveParams(paramsRes.data);
        setLiveInstjudi(instjudiRes.data);
      } catch (e) {
        console.error('Error fetching config:', e);
      }
    };
    fetchData();
  }, []);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '2rem' }}>
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
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#f59e0b'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
        }}>
          <BookOpen size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Gastos y Honorarios de Apremio
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0 }}>
            Cómo se calculan los costos en el sistema legacy (InfoGov / Recaudación)
          </p>
        </div>
      </div>

      {/* 1. Resumen Ejecutivo */}
      <Section title="Resumen Ejecutivo" icon={Zap} color="#7c4dff" defaultOpen={true}>
        <Alert type="important">
          <strong>Los gastos de apremio se calculan al momento de EMITIR EL BOLETO, no al cargar las instancias.</strong>
          <br />Se persisten en la tabla <Tag color="#7c4dff">boleapre</Tag> y NO se recalculan si cambian los parámetros.
        </Alert>
        <p style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.7 }}>
          El sistema utiliza una arquitectura de <strong>3 niveles de configuración</strong>:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          {[
            { name: 'paraapre', desc: 'Parámetros globales (mínimos/máximos)', color: '#3b82f6' },
            { name: 'instjudi', desc: 'Porcentajes por instancia judicial', color: '#10b981' },
            { name: 'escaapre', desc: 'Escalas por rango de monto', color: '#f59e0b' },
            { name: 'instapre', desc: 'Instancias reales del apremio', color: '#ef4444' },
            { name: 'boleapre', desc: 'Gastos calculados y persistidos', color: '#7c4dff' }
          ].map(t => (
            <div key={t.name} style={{
              padding: '0.75rem 1rem',
              background: t.color + '10',
              border: `1px solid ${t.color}25`,
              borderRadius: '10px'
            }}>
              <Tag color={t.color}>{t.name}</Tag>
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 2. Parámetros Globales */}
      <Section title="Parámetros Globales (paraapre)" icon={Database} color="#3b82f6" defaultOpen={true}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Contiene los <strong>montos mínimos y máximos</strong> que actúan como topes para los cálculos.
          Solo existe <strong>1 registro</strong> en esta tabla — se actualiza por ordenanza.
        </p>
        <DataTable
          headers={['Campo', 'Descripción', 'Valor Actual']}
          highlightCol={2}
          rows={
            liveParams && liveParams.length > 0
              ? [
                  ['CamiPaap', 'Comisión administrativa MÍNIMA', '$' + Number(liveParams[0].CamiPaap).toLocaleString('es-AR')],
                  ['CamaPaap', 'Comisión administrativa MÁXIMA', '$' + Number(liveParams[0].CamaPaap).toLocaleString('es-AR')],
                  ['AplePaap', 'Aporte Ley (gastos legales) — tope', '$' + Number(liveParams[0].AplePaap).toLocaleString('es-AR')],
                  ['DefiPaap', 'Deficientes (descuento) — tope', '$' + Number(liveParams[0].DefiPaap).toLocaleString('es-AR')],
                  ['TajuPaap', 'Tasa de Justicia — tope', '$' + Number(liveParams[0].TajuPaap).toLocaleString('es-AR')],
                  ['HrmiPaap', 'Honorarios MÍNIMOS recaudador', '$' + Number(liveParams[0].HrmiPaap).toLocaleString('es-AR')],
                  ['HrmaPaap', 'Honorarios MÁXIMOS recaudador (0=sin tope)', '$' + Number(liveParams[0].HrmaPaap).toLocaleString('es-AR')]
                ]
              : [['Cargando...', '', '']]
          }
        />
      </Section>

      {/* 3. Instancias Judiciales */}
      <Section title="Instancias Judiciales (instjudi)" icon={Scale} color="#10b981" defaultOpen={true}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Define los <strong>porcentajes</strong> que se aplican según la etapa del proceso de apremio.
          Cada instancia tiene sus propios porcentajes para cada tipo de gasto.
        </p>
        {liveInstjudi && liveInstjudi.length > 0 ? (
          <DataTable
            headers={['Cód', 'Instancia', 'CoadInju %', 'HoreInju %', 'HoofInju %', 'ApleInju %', 'DefiInju %', 'KiofInju km']}
            highlightCol={1}
            rows={liveInstjudi.map(r => [
              r.CodiInju,
              r.DetaInju,
              r.CoadInju + '%',
              r.HoreInju + '%',
              r.HoofInju + '%',
              r.ApleInju + '%',
              r.DefiInju + '%',
              r.KiofInju
            ])}
          />
        ) : (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>Cargando datos...</p>
        )}
      </Section>

      {/* 4. Fórmula de Cálculo */}
      <Section title="Fórmula de Cálculo" icon={Calculator} color="#ef4444" defaultOpen={true}>
        <Alert type="info">
          La <strong>base de cálculo</strong> es siempre: <code>Capital (SaldCtct) + Recargo (RecaCtct)</code> leídos de la cuenta corriente al momento de emitir.
        </Alert>

        <DataTable
          headers={['Campo', 'Fórmula', 'Descripción']}
          highlightCol={0}
          rows={[
            ['CoadBoap', 'CLAMP(Base × CoadInju%, CamiPaap, CamaPaap)', 'Comisión administrativa'],
            ['ApleBoap', 'MIN(Base × ApleInju%, AplePaap)', 'Aporte Ley / Gastos legales'],
            ['TasaJust.', 'LOOKUP(escaapre) ó TajuPaap', 'Tasa de Justicia (solo si instancia > 1)'],
            ['DefiBoap', 'ROUND(TasaJust × DefiInju% / 100, 2)', 'Descuento Deficiente (descuento sobre la Tasa de Justicia.)'],
            ['HoreBoap', 'CLAMP(Base × HoreInju%, HrmiPaap, HrmaPaap)', 'Honorarios del recaudador'],
            ['HoofBoap', 'Base × HoofInju%', 'Honorarios del oficial de justicia'],
            ['MoreBoap', 'km_recaudador × tarifa_zona', 'Movilidad del recaudador'],
            ['MoofBoap', 'km_oficial × tarifa_zona', 'Movilidad del oficial de justicia'],
            ['IcomBoap', 'interés_acum(CoadBoap)', 'Interés sobre comisión'],
            ['IrecBoap', 'interés_acum(HoreBoap)', 'Interés sobre honorarios recaud.'],
            ['IofiBoap', 'interés_acum(HoofBoap)', 'Interés sobre honorarios oficial']
          ]}
        />

        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
            Pseudocódigo simplificado:
          </p>
          <CodeBlock>{`Base = Capital + Recargo

CoadBoap = CLAMP(Base × CoadInju%, CamiPaap_min, CamaPaap_max)
ApleBoap = MIN(Base × ApleInju%, AplePaap_tope)
TasaJust = LOOKUP(escaapre, Base) ?? TajuPaap_fijo
DefiBoap = ROUND(TasaJust × DefiInju% / 100, 2)
HoreBoap = CLAMP(Base × HoreInju%, HrmiPaap_min, HrmaPaap_max)
HoofBoap = Base × HoofInju%
MoreBoap = km_recaudador × tarifa_zona
MoofBoap = km_oficial × tarifa_zona

TOTAL = Σ(11 campos)`}</CodeBlock>
        </div>
      </Section>

      {/* 5. Timing */}
      <Section title="¿Cuándo se calcula?" icon={FileText} color="#f59e0b" defaultOpen={true}>
        <Alert type="warning">
          <strong>NUNCA al cargar instancias.</strong> El INSERT INTO instapre solo guarda datos administrativos (recaudador, oficial, km, zona). No calcula ningún gasto.
        </Alert>

        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
          El cálculo se dispara en 4 contextos:
        </p>

        <DataTable
          headers={['#', 'Contexto', 'Formulario Legacy', 'Función', 'Acción']}
          highlightCol={1}
          rows={[
            ['1', 'Emisión individual', 'frmEmisionBoleto', 'BuscaGastosApremio()', 'Muestra total al seleccionar'],
            ['2', 'Emisión con detalle', 'frmEmisionBoleto', 'BuscaGastosApremioDetalle()', 'Calcula 11 campos → INSERT boleapre'],
            ['3', 'Boleta solo gastos', 'frmGastosyHonorariosDeApremio', 'BuscaGastosApremioDetalle()', 'Boleta sin capital, solo gastos'],
            ['4', 'Planes de pago', 'frmPlanesdePago', 'BuscaGastosApremio()', 'Incluye gastos en plan de facilidades']
          ]}
        />

        <div style={{
          marginTop: '1.25rem',
          padding: '1.25rem',
          background: 'var(--bg)',
          borderRadius: '12px',
          border: '1px solid var(--border)'
        }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
            Flujo temporal:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { step: '1', label: 'Se crea la instancia', detail: 'INSERT INTO instapre — solo datos admin, SIN gastos', color: '#3b82f6' },
              { step: '2', label: 'Se solicita emitir boleta', detail: 'Lee Capital y Recargo actuales de ctacte', color: '#10b981' },
              { step: '3', label: 'Se calcula', detail: 'BuscaGastosInstancia() → lee paraapre, instjudi, escaapre', color: '#f59e0b' },
              { step: '4', label: 'Se persiste', detail: 'INSERT INTO boleapre con los 11 campos calculados', color: '#7c4dff' }
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0
                }}>{s.step}</div>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.82rem' }}>{s.label}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginLeft: '0.5rem' }}>— {s.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>



      {/* 7. Implicancias Importantes */}
      <Section title="Implicancias Importantes" icon={AlertTriangle} color="#ef4444" defaultOpen={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Alert type="warning">
            <strong>Snapshot al emitir:</strong> Los gastos dependen del saldo al momento de emitir. Si la deuda cambia después, los gastos ya emitidos NO se recalculan.
          </Alert>
          <Alert type="info">
            <strong>Parámetros al vuelo:</strong> Los topes de paraapre se leen al momento de calcular. Si se actualizan, las próximas emisiones usarán el nuevo valor, pero las boletas ya emitidas no cambian.
          </Alert>
          <Alert type="important">
            <strong>Avance de instancia:</strong> Si un apremio pasa de Notificación a Demanda, la nueva boleta calculará gastos con los porcentajes de Demanda (más honorarios).
          </Alert>
          <Alert type="info">
            <strong>Escala vacía:</strong> Actualmente <Tag>escaapre</Tag> tiene 0 registros, por lo que la Tasa de Justicia siempre usa el monto fijo de <Tag color="#f59e0b">TajuPaap = $18,600</Tag>.
          </Alert>
        </div>
      </Section>

      {/* 8. Estructura boleapre */}
      <Section title="Campos de boleapre (output)" icon={Database} color="#7c4dff" defaultOpen={false}>
        <DataTable
          headers={['Campo', 'Tipo', 'Descripción']}
          highlightCol={0}
          rows={[
            ['PeriBole', 'year', 'Período del boleto'],
            ['NumeBole', 'int', 'Número del boleto'],
            ['NumeApre', 'int', 'Número de apremio'],
            ['CodiInju', 'tinyint', 'Instancia judicial al emitir'],
            ['CodiFapa', 'int', 'Facilidad de pago (si aplica)'],
            ['CuotDefa', 'smallint', 'Cuota de la facilidad'],
            ['FealBoap', 'date', 'Fecha de alta del boleto apremio'],
            ['FeenAcpa', 'date', 'Fecha de pago (si fue cobrado)'],
            ['EstaBoap', 'enum', 'Generado / Emitido / Pagado / Anulado ...'],
            ['CoadBoap', 'decimal(12,2)', 'Comisión administrativa'],
            ['ApleBoap', 'decimal(12,2)', 'Aporte Ley / Gastos legales'],
            ['DefiBoap', 'decimal(12,2)', 'Descuentos'],
            ['ReseBoap', 'decimal(12,2)', 'Resumen / Bonificaciones'],
            ['HoreBoap', 'decimal(12,2)', 'Honorarios recaudador'],
            ['HoofBoap', 'decimal(12,2)', 'Honorarios oficial de justicia'],
            ['MoreBoap', 'decimal(12,2)', 'Movilidad recaudador'],
            ['MoofBoap', 'decimal(12,2)', 'Movilidad oficial de justicia'],
            ['IcomBoap', 'decimal(12,2)', 'Interés sobre comisión'],
            ['IrecBoap', 'decimal(12,2)', 'Interés sobre honorarios recaud.'],
            ['IofiBoap', 'decimal(12,2)', 'Interés sobre honorarios oficial']
          ]}
        />
      </Section>

      {/* 9. Configuración y Tablas */}
      <Section title="Configuración y Tablas (Base de Datos)" icon={Table} color="#10b981" defaultOpen={true}>
        {/* Tabs Selector */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
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
            onClick={() => fetchTableData(activeTab)}
            disabled={tableLoading}
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
            <RefreshCw size={16} className={tableLoading ? 'spin' : ''} />
            Actualizar
          </button>
        </div>

        {/* Table Container */}
        <div style={{ 
          maxHeight: '400px', 
          overflow: 'auto', 
          background: 'var(--card)', 
          borderRadius: '14px', 
          border: '1px solid var(--border)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {tableLoading ? (
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
      </Section>
    </div>
  );
};

export default GastosApremioReport;
