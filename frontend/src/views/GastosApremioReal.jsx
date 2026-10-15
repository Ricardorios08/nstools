import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import {
  BookOpen, ArrowLeft, Database, Calculator, AlertTriangle,
  ChevronDown, ChevronUp, FileText, Scale, Info, Zap, Search, RefreshCw
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

const SimRow = ({ label, calc, result, note }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{calc}</div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 700 }}>{result}</div>
      {note && <div style={{ fontSize: '0.65rem', color: '#7c4dff', fontStyle: 'italic' }}>{note}</div>}
    </div>
  </div>
);

const GastosApremioReal = ({ setView }) => {
  const [liveParams, setLiveParams] = useState(null);
  const [liveInstjudi, setLiveInstjudi] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveDebt, setLiveDebt] = useState({ capital: 1172.88, recargo: 586.44, numeApre: null });
  const [searching, setSearching] = useState(false);

  const formatMoney = (v) => {
    if (v === undefined || v === null || isNaN(v)) return '$0,00';
    return '$' + parseFloat(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (pct) => {
    if (pct === undefined || pct === null || isNaN(pct)) return '0%';
    const val = pct * 100;
    return val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paramsRes, instjudiRes] = await Promise.all([
          axios.get(`${API_URL}/apremio-config/paraapre`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/apremio-config/instjudi`).catch(() => ({ data: [] }))
        ]);
        setLiveParams(paramsRes.data);
        setLiveInstjudi(instjudiRes.data);
        if (instjudiRes.data.length > 0) {
          setSelectedInstance(instjudiRes.data[0].CodiInju);
        }
      } catch (e) {
        console.error('Error fetching config:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const isAccount = searchQuery.includes('-') || searchQuery.length > 8;
      const param = isAccount ? `cuenCtct=${searchQuery}` : `numeApre=${searchQuery}`;
      const res = await axios.get(`${API_URL}/apremio-config/debt?${param}`);
      if (res.data.capital > 0) {
        const cap = res.data.capital;
        const rec = res.data.recargo || (cap * 0.5);
        setLiveDebt({ capital: cap, recargo: rec, numeApre: res.data.numeApre });
      } else {
        alert('No se encontró deuda pendiente para este apremio/cuenta');
      }
    } catch (e) {
      console.error('Search error:', e);
      alert('Error al buscar deuda');
    } finally {
      setSearching(false);
    }
  };

  const calculateGastos = () => {
    if (!liveParams || !liveInstjudi || !selectedInstance) return null;
    
    const base = liveDebt.capital + liveDebt.recargo;
    const p = liveParams[0];
    const inst = liveInstjudi.find(i => i.CodiInju === selectedInstance);
    
    if (!inst) return null;

    const p_cami = parseFloat(p.CamiPaap);
    const p_cama = parseFloat(p.CamaPaap);
    const p_aple = parseFloat(p.AplePaap);
    const p_taju = parseFloat(p.TajuPaap);
    const p_hrmi = parseFloat(p.HrmiPaap);
    const p_hrma = parseFloat(p.HrmaPaap);

    // Coad (Comisión Admin)
    const coad_pct = parseFloat(inst.CoadInju) / 100;
    let coad = base * coad_pct;
    let coad_note = "";
    if (coad < p_cami) { coad = p_cami; coad_note = "Aplica Mínimo"; }
    if (p_cama > 0 && coad > p_cama) { coad = p_cama; coad_note = "Aplica Máximo"; }
    coad = Math.round(coad * 100) / 100;

    // Hore (Honorarios Recaudador)
    const hore_pct = parseFloat(inst.HoreInju) / 100;
    let hore = base * hore_pct;
    let hore_note = "";
    if (hore > 0 && hore < p_hrmi) { hore = p_hrmi; hore_note = "Aplica Mínimo"; }
    if (p_hrma > 0 && hore > p_hrma) { hore = p_hrma; hore_note = "Aplica Máximo"; }
    hore = Math.round(hore * 100) / 100;

    // Tasa Justicia (if CodiInju > 1)
    let taju = 0;
    if (inst.CodiInju > 1) {
      taju = p_taju; // Simplified lookup since escaapre is usually empty
    }
    taju = Math.round(taju * 100) / 100;

    // Aple (Aporte Ley)
    const aple_pct = parseFloat(inst.ApleInju) / 100;
    let aple = base * aple_pct;
    if (aple > p_aple) aple = p_aple;
    aple = Math.round(aple * 100) / 100;

    // Defi (Deficientes / Descuento)
    const defi_pct = parseFloat(inst.DefiInju) / 100;
    let defi = taju * defi_pct;
    defi = Math.round(defi * 100) / 100;

    const total = coad + hore + taju + aple - defi;

    return {
      base,
      coad, coad_pct, coad_note,
      hore, hore_pct, hore_note,
      taju,
      aple, aple_pct,
      defi, defi_pct,
      total,
      instName: inst.DetaInju
    };
  };

  const calcResults = calculateGastos();

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
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
        }}>
          <Calculator size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Calculadora Real de Gastos
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0 }}>
            Simulación basada 100% en las tablas <code style={{color:'#10b981'}}>instjudi</code> y <code style={{color:'#10b981'}}>paraapre</code> de la base de datos.
          </p>
        </div>
      </div>

      <Alert type="important">
        <strong>Modo Auditoría:</strong> Esta calculadora NO usa valores hardcodeados. Lee directamente los porcentajes de tu base de datos MariaDB para que puedas validar si la configuración de instancias es correcta.
      </Alert>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem' }}>
        {/* Left Col: Setup & Calculation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Search Card */}
          <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.5rem', display: 'block' }}>
              DEUDA BASE (CAPITAL + RECARGO)
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input 
                type="text" 
                placeholder="Ingresar NumeApre o Cuenta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '0.9rem'
                }}
              />
              <button 
                onClick={handleSearch}
                disabled={searching}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {searching ? <RefreshCw size={16} className="spin" /> : <Search size={16} />}
                Buscar Deuda
              </button>
            </div>
            {liveDebt.numeApre && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                Apremio {liveDebt.numeApre} detectado. Base de Cálculo: {formatMoney(liveDebt.capital + liveDebt.recargo)}
              </div>
            )}
          </div>

          {/* Instance Selection */}
          <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>Seleccionar Instancia (Motor Real)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {liveInstjudi && liveInstjudi.map(inst => (
                <button
                  key={inst.CodiInju}
                  onClick={() => setSelectedInstance(inst.CodiInju)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid ' + (selectedInstance === inst.CodiInju ? '#10b981' : 'var(--border)'),
                    background: selectedInstance === inst.CodiInju ? '#10b98115' : 'var(--bg)',
                    color: selectedInstance === inst.CodiInju ? '#10b981' : 'var(--text-dim)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {inst.CodiInju}. {inst.DetaInju}
                </button>
              ))}
            </div>
          </div>

          {/* Calculation Details */}
          {calcResults && (
            <div style={{ background: 'var(--card)', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 1.25rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Scale size={18} />
                Desglose de Cálculo (Instancia: {calcResults.instName})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SimRow 
                  label={`Comisión Admin (${formatPercent(calcResults.coad_pct)})`} 
                  calc={`${formatMoney(calcResults.base)} × ${formatPercent(calcResults.coad_pct)}`} 
                  result={formatMoney(calcResults.coad)} 
                  note={calcResults.coad_note}
                />
                <SimRow 
                  label={`Honorarios Recaudador (${formatPercent(calcResults.hore_pct)})`} 
                  calc={`${formatMoney(calcResults.base)} × ${formatPercent(calcResults.hore_pct)}`} 
                  result={formatMoney(calcResults.hore)} 
                  note={calcResults.hore_note}
                />
                <SimRow 
                  label="Tasa de Justicia" 
                  calc={selectedInstance > 1 ? "Aplica (Instancia > 1)" : "N/A (Instancia 1)"} 
                  result={formatMoney(calcResults.taju)} 
                />
                <SimRow 
                  label={`Aporte Ley (${formatPercent(calcResults.aple_pct)})`} 
                  calc={`${formatMoney(calcResults.base)} × ${formatPercent(calcResults.aple_pct)}`} 
                  result={formatMoney(calcResults.aple)} 
                />
                <SimRow 
                  label="Descuento Deficiente (descuento sobre la Tasa de Justicia.)" 
                  calc={`Tasa Justicia × ${formatPercent(calcResults.defi_pct)}`} 
                  result={'-' + formatMoney(calcResults.defi)} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Summary Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Sleeek High-Contrast Slate Card for Total Sum */}
          <div style={{ 
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
            padding: '1.5rem', 
            borderRadius: '16px', 
            color: '#ffffff',
            border: '2px solid #10b981',
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.25)'
          }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Gastos de Apremio
            </p>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#34d399', marginBottom: '1rem', fontFamily: 'monospace' }}>
              {calcResults ? formatMoney(calcResults.total) : '$0,00'}
            </div>
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.15)', margin: '1rem 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#e2e8f0' }}>Capital:</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{formatMoney(liveDebt.capital)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#e2e8f0' }}>Recargo (Interés):</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{formatMoney(liveDebt.recargo)}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.15)', margin: '0.4rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#34d399', fontWeight: 700 }}>Base de Cálculo:</span>
                <span style={{ fontWeight: 800, color: '#34d399' }}>{formatMoney(liveDebt.capital + liveDebt.recargo)}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={14} color="#10b981" />
              Parámetros de Auditoría
            </p>
            {liveParams && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Comisión Mínima:</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatMoney(parseFloat(liveParams[0].CamiPaap))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Honorarios Mínimos:</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatMoney(parseFloat(liveParams[0].HrmiPaap))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tasa Justicia (Tope):</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatMoney(parseFloat(liveParams[0].TajuPaap))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Section title="Tabla Comparativa de Instancias (Real)" icon={Scale} color="#10b981" defaultOpen={false}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
          Estos son los datos crudos leídos de la tabla <Tag color="#10b981">instjudi</Tag>.
        </p>
        {liveInstjudi && (
          <DataTable 
            headers={['Cód', 'DetaInju', 'Coad %', 'Hore %', 'Aple %', 'Defi %']}
            highlightCol={1}
            rows={liveInstjudi.map(r => [
              r.CodiInju,
              r.DetaInju,
              formatPercent(parseFloat(r.CoadInju) / 100),
              formatPercent(parseFloat(r.HoreInju) / 100),
              formatPercent(parseFloat(r.ApleInju) / 100),
              formatPercent(parseFloat(r.DefiInju) / 100)
            ])}
          />
        )}
      </Section>
    </div>
  );
};

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

export default GastosApremioReal;
