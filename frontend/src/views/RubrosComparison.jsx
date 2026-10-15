import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  TrendingUp,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ArrowDownCircle,
  Database,
  X,
  Calculator,
  Info
} from 'lucide-react';

const RubrosComparison = () => {
    const [padron, setPadron] = useState('31398');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [selectedRubro, setSelectedRubro] = useState(null);
    const [showCalcModal, setShowCalcModal] = useState(false);

    const fetchData = async () => {
        if (!padron) return;
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/comercio-rubros/${padron}`);
            setData(res.data);
        } catch (err) {
            console.error('Error fetching rubros:', err);
            setError(err.response?.data?.error || 'Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (padron) fetchData();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData();
    };

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.startsWith('0001') || dateStr.startsWith('1899')) return null;
        return new Date(dateStr).toLocaleDateString('es-AR');
    };

    const isInactive = (dateStr) => {
        const date = formatDate(dateStr);
        return date !== null;
    };

    const calculateItemValue = (r, engine, allRubros) => {
        const isPrincipal = engine === 'maria' ? r.isPrincipal === 'Si' : r.type === 'P';
        const utmValue = parseFloat(engine === 'maria' ? (r.utmValue || 0) : (r.utm || 0));
        const percentage = parseFloat(r.percentage || 0);

        if (isPrincipal) return utmValue;

        // If it's secondary and has a percentage
        if (percentage > 0) {
            // Find total principal
            const principalTotal = allRubros
                .filter(item => (engine === 'maria' ? item.isPrincipal === 'Si' : item.type === 'P') && !isInactive(item.endDate))
                .reduce((acc, item) => acc + parseFloat(engine === 'maria' ? (item.utmValue || 0) : (item.utm || 0)), 0);
            
            // Percentage might be 0.15 in Maria or 15 in PG
            const factor = engine === 'maria' && percentage < 1 ? percentage : (percentage / 100);
            return principalTotal * factor;
        }

        return utmValue;
    };

    const calculateTotals = (rubros, engine) => {
        let principal = 0;
        let secondary = 0;

        rubros.forEach(r => {
            if (isInactive(r.endDate)) return;
            const val = calculateItemValue(r, engine, rubros);
            const isPrin = engine === 'maria' ? r.isPrincipal === 'Si' : r.type === 'P';
            if (isPrin) principal += val;
            else secondary += val;
        });

        return { principal, secondary };
    };

    const mariaTotals = data ? calculateTotals(data.maria, 'maria') : { principal: 0, secondary: 0 };
    const pgTotals = data ? calculateTotals(data.postgres, 'pg') : { principal: 0, secondary: 0 };

    const RawDataModal = ({ item, onClose }) => {
        if (!item) return null;
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
                <div style={{ background: '#1e293b', width: '90%', maxWidth: '800px', maxHeight: '80vh', borderRadius: '1.5rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                    <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <Database size={24} style={{ color: '#60a5fa' }} />
                            Datos Crudos de Base de Datos
                        </h3>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                    </div>
                    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                        <pre style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '1rem', color: '#34d399', fontSize: '0.85rem', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(item, null, 4)}
                        </pre>
                    </div>
                </div>
            </div>
        );
    };

    const CalcExplainerModal = ({ onClose }) => {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(10px)' }}>
                <div style={{ background: '#0f172a', width: '90%', maxWidth: '900px', maxHeight: '90vh', borderRadius: '2rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(96, 165, 250, 0.3)', boxShadow: '0 0 50px rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ padding: '2rem', background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(168, 85, 247, 0.1))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '1rem', color: '#60a5fa' }}>
                            <Calculator size={32} />
                            Lógica de Cálculo de Rubros
                        </h2>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%' }}>
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div style={{ padding: '3rem', overflowY: 'auto', flex: 1 }}>
                        <div className="calc-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Formula Section */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ color: '#facc15', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Info size={20} />
                                    1. Rubros Principales (PRIN)
                                </h3>
                                <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', borderLeft: '4px solid #facc15' }}>
                                    <code style={{ fontSize: '1.2rem', color: '#fff' }}>UTM_Base = Valor_Tarifa</code>
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '1rem' }}>
                                        El valor base se extrae directamente de la tabla de tarifas para el año vigente (2026).
                                    </p>
                                </div>
                                <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                                    <strong>Tablas:</strong> <code>tarifariacomercio</code> (MariaDB) / <code>rubro</code> (Postgres)
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ color: '#4ade80', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <TrendingUp size={20} />
                                    2. Rubros Secundarios (SEC)
                                </h3>
                                <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '1rem', borderLeft: '4px solid #4ade80' }}>
                                    <code style={{ fontSize: '1rem', color: '#fff' }}>UTM_Sec = Sum(Principales) * %</code>
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '1rem' }}>
                                        Si el rubro es porcentual, se aplica el porcentaje sobre la suma de todas las actividades principales activas.
                                    </p>
                                </div>
                                <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                                    <strong>Tablas:</strong> <code>tarifariaporcentajes</code> (MariaDB) / <code>rubsecporc</code> (Postgres)
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2.5rem', background: 'rgba(59, 130, 246, 0.05)', padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <h3 style={{ color: '#60a5fa', marginBottom: '1.5rem' }}>3. Conversión a Pesos ($)</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                                        Para obtener el importe final en pesos (Grand Total), se multiplica la cantidad de UTM resultantes por el valor de la <strong>Unidad Tributaria Municipal (UTM)</strong> configurada para el período.
                                    </p>
                                </div>
                                <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '1.5rem', textAlign: 'center', border: '1px dashed #60a5fa' }}>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Valor UTM 2026</span>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#60a5fa' }}>$ 130,00</span>
                                </div>
                            </div>
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(250, 204, 21, 0.1)', borderRadius: '0.75rem', border: '1px solid rgba(250, 204, 21, 0.2)', fontSize: '0.85rem', color: '#fde047' }}>
                                <strong>Nota Histórica:</strong> El valor de 112,65 que aparece en reportes de 2025 corresponde al valor de la UTM de ese año fiscal.
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
                            Esta lógica ha sido validada contra los procedimientos almacenados y el código fuente original del sistema legacy.
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="rubros-container" style={{ 
            padding: '2rem', 
            color: '#fff', 
            height: '100%', 
            overflowY: 'auto',
            background: '#0f172a' 
        }}>
            {selectedRubro && <RawDataModal item={selectedRubro} onClose={() => setSelectedRubro(null)} />}
            {showCalcModal && <CalcExplainerModal onClose={() => setShowCalcModal(false)} />}

            {/* Header section with search */}
            <div className="header-section" style={{ 
                background: 'rgba(30, 41, 59, 0.7)', 
                backdropFilter: 'blur(10px)',
                borderRadius: '1.5rem',
                padding: '2rem',
                marginBottom: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, background: 'linear-gradient(to right, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                Comparativo de Rubros
                            </h1>
                            <button 
                                onClick={() => setShowCalcModal(true)}
                                style={{
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#60a5fa',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                title="¿Cómo se calcula?"
                            >
                                <HelpCircle size={18} />
                            </button>
                        </div>
                        <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Auditoría de Actividades de Comercio (MariaDB vs PostgreSQL)</p>
                    </div>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input 
                                type="text" 
                                value={padron}
                                onChange={(e) => setPadron(e.target.value)}
                                placeholder="Padrón o CodiCome..."
                                style={{
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '0.75rem',
                                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                                    color: '#fff',
                                    width: '250px',
                                    outline: 'none',
                                    transition: 'all 0.3s'
                                }}
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={loading}
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                border: 'none',
                                borderRadius: '0.75rem',
                                padding: '0.75rem 1.5rem',
                                color: '#fff',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
                                transition: 'all 0.3s'
                            }}
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
                            Buscar
                        </button>
                    </form>
                </div>

                {data && (
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 255, 255, 0.05)', padding: '1rem 1.5rem', borderRadius: '1rem' }}>
                            <Building2 size={24} style={{ color: '#60a5fa' }} />
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Comercio</span>
                                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{data.commerce.name}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255, 255, 255, 0.05)', padding: '1rem 1.5rem', borderRadius: '1rem' }}>
                            <Layers size={24} style={{ color: '#a855f7' }} />
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>ID / Padrón</span>
                                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{data.commerce.codiCome || padron}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '1rem', borderRadius: '0.75rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {data && (
                <div className="rubros-comparison-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* MariaDB Side */}
                    <div className="engine-card" style={{ 
                        background: 'rgba(30, 41, 59, 0.4)', 
                        borderRadius: '1.5rem', 
                        padding: '1.5rem', 
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#00758f' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', margin: 0 }}>
                                <span style={{ padding: '0.5rem', background: 'rgba(0, 117, 143, 0.2)', borderRadius: '0.5rem' }}>🦭</span>
                                MariaDB (Legacy)
                            </h2>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(0, 117, 143, 0.2)', color: '#00d1ff', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: '600' }}>RECAUDACION2</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                                <thead>
                                    <tr style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Rubro</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Vigencia</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>Tipo</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Principal (UTM)</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Secundario (UTM)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.maria.map((r, idx) => {
                                        const bajaname = formatDate(r.endDate);
                                        const inactive = bajaname !== null;
                                        const itemValue = calculateItemValue(r, 'maria', data.maria);

                                        return (
                                            <tr key={idx} 
                                                onClick={() => setSelectedRubro(r)}
                                                style={{ 
                                                    background: inactive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.02)', 
                                                    borderRadius: '0.5rem', 
                                                    transition: 'all 0.2s',
                                                    cursor: 'pointer',
                                                    border: inactive ? '1px solid rgba(239, 68, 68, 0.3)' : 'none'
                                                }}>
                                                <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem', maxWidth: '150px' }}>
                                                    <div style={{ fontWeight: '600', color: inactive ? '#fca5a5' : '#fff' }}>{r.CodiSubr}</div>
                                                    <div style={{ fontSize: '0.75rem', color: inactive ? '#f87171' : '#94a3b8' }}>
                                                        {r.description}
                                                        {parseFloat(r.percentage || 0) > 0 && (
                                                            <span style={{ color: '#fbbf24', marginLeft: '0.5rem' }}>
                                                                ({parseFloat(r.percentage) < 1 ? (parseFloat(r.percentage) * 100) : r.percentage}%)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span title="Fecha de Alta">A: {formatDate(r.startDate) || '-'}</span>
                                                        {inactive && (
                                                            <span style={{ color: '#ef4444', fontWeight: '600' }} title="Fecha de Baja">
                                                                B: {bajaname}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                                    <span style={{ 
                                                        padding: '0.2rem 0.5rem', 
                                                        borderRadius: '0.4rem', 
                                                        fontSize: '0.7rem', 
                                                        fontWeight: '700',
                                                        background: r.isPrincipal === 'Si' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                        color: r.isPrincipal === 'Si' ? '#4ade80' : '#94a3b8'
                                                    }}>
                                                        {r.isPrincipal === 'Si' ? 'PRIN' : 'SEC'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: '700', color: inactive ? '#991b1b' : (r.isPrincipal === 'Si' ? '#fff' : '#475569') }}>
                                                    {r.isPrincipal === 'Si' ? itemValue.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: '700', color: inactive ? '#991b1b' : (r.isPrincipal === 'No' ? '#fff' : '#475569') }}>
                                                    {r.isPrincipal === 'No' ? itemValue.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderTop: '2px solid rgba(255, 255, 255, 0.1)' }}>
                                        <td colSpan="3" style={{ padding: '1rem 0.5rem', fontWeight: '700', fontSize: '0.9rem' }}>TOTAL ACTIVOS</td>
                                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#60a5fa' }}>
                                            {mariaTotals.principal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#a855f7' }}>
                                            {mariaTotals.secondary.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* PostgreSQL Side */}
                    <div className="engine-card" style={{ 
                        background: 'rgba(30, 41, 59, 0.4)', 
                        borderRadius: '1.5rem', 
                        padding: '1.5rem', 
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#336791' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', margin: 0 }}>
                                <span style={{ padding: '0.5rem', background: 'rgba(51, 103, 145, 0.2)', borderRadius: '0.5rem' }}>🐘</span>
                                PostgreSQL (Migrada)
                            </h2>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(51, 103, 145, 0.2)', color: '#82b1ff', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: '600' }}>PRODUCTION</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                                <thead>
                                    <tr style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Rubro</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Vigencia</th>
                                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>Tipo</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Principal (UTM)</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Secundario (UTM)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.postgres.map((r, idx) => {
                                        const existsInMaria = data.maria.some(mr => mr.CodiSubr.toString() === r.rubcod.toString());
                                        const typeMatch = data.maria.some(mr => mr.CodiSubr.toString() === r.rubcod.toString() && (mr.isPrincipal === 'Si' ? 'P' : 'S') === r.type);
                                        
                                        const bajaname = formatDate(r.endDate);
                                        const inactive = bajaname !== null;
                                        const itemValue = calculateItemValue(r, 'pg', data.postgres);

                                        return (
                                            <tr key={idx} 
                                                onClick={() => setSelectedRubro(r)}
                                                style={{ 
                                                    background: inactive ? 'rgba(239, 68, 68, 0.1)' : (!existsInMaria ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255, 255, 255, 0.02)'), 
                                                    borderRadius: '0.5rem',
                                                    cursor: 'pointer'
                                                }}>
                                                <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem', maxWidth: '150px' }}>
                                                    <div style={{ fontWeight: '600', color: inactive ? '#fca5a5' : '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {r.rubcod}
                                                        {!existsInMaria && <AlertCircle size={14} style={{ color: '#eab308' }} />}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: inactive ? '#f87171' : '#94a3b8' }}>
                                                        {r.description}
                                                        {parseFloat(r.percentage || 0) > 0 && (
                                                            <span style={{ color: '#fbbf24', marginLeft: '0.5rem' }}>
                                                                ({r.percentage}%)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span title="Fecha de Alta">A: {formatDate(r.startDate) || '-'}</span>
                                                        {inactive && (
                                                            <span style={{ color: '#ef4444', fontWeight: '600' }} title="Fecha de Baja">
                                                                B: {bajaname}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                                    <span style={{ 
                                                        padding: '0.2rem 0.5rem', 
                                                        borderRadius: '0.4rem', 
                                                        fontSize: '0.7rem', 
                                                        fontWeight: '700',
                                                        background: r.type === 'P' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                        color: r.type === 'P' ? '#4ade80' : '#94a3b8',
                                                        border: !typeMatch && existsInMaria ? '1px solid #ef4444' : 'none'
                                                    }}>
                                                        {r.type === 'P' ? 'PRIN' : 'SEC'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: '700', color: inactive ? '#991b1b' : (r.type === 'P' ? '#fff' : '#475569') }}>
                                                    {r.type === 'P' ? itemValue.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                                                </td>
                                                <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: '700', color: inactive ? '#991b1b' : (r.type === 'S' ? '#fff' : '#475569') }}>
                                                    {r.type === 'S' ? itemValue.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderTop: '2px solid rgba(255, 255, 255, 0.1)' }}>
                                        <td colSpan="3" style={{ padding: '1rem 0.5rem', fontWeight: '700', fontSize: '0.9rem' }}>TOTAL ACTIVOS</td>
                                        <td style={{ 
                                            padding: '1rem 0.5rem', 
                                            textAlign: 'right', 
                                            fontWeight: '800', 
                                            color: '#60a5fa',
                                            textDecoration: mariaTotals.principal !== pgTotals.principal ? 'underline wavy #ef4444' : 'none'
                                        }}>
                                            {pgTotals.principal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ 
                                            padding: '1rem 0.5rem', 
                                            textAlign: 'right', 
                                            fontWeight: '800', 
                                            color: '#a855f7',
                                            textDecoration: mariaTotals.secondary !== pgTotals.secondary ? 'underline wavy #ef4444' : 'none'
                                        }}>
                                            {pgTotals.secondary.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {!data && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#64748b' }}>
                    <div style={{ padding: '2rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '50%', marginBottom: '1.5rem' }}>
                        <TrendingUp size={64} style={{ color: '#334155' }} />
                    </div>
                    <p style={{ fontSize: '1.25rem', fontWeight: '500' }}>Ingrese un padrón para comenzar la auditoría de rubros</p>
                    <p style={{ fontSize: '0.9rem', maxWidth: '400px', textAlign: 'center', marginTop: '0.5rem' }}>
                        El sistema comparará las actividades activas, sus fechas de alta/baja y los valores de UTM asignados en cada motor.
                    </p>
                </div>
            )}

            {/* Comparison Summary Modal/Banner if they differ */}
            {data && (mariaTotals.principal !== pgTotals.principal || mariaTotals.secondary !== pgTotals.secondary) && (
                <div style={{ 
                    marginTop: '2rem', 
                    padding: '1.5rem', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <AlertCircle style={{ color: '#ef4444' }} />
                        <span style={{ color: '#f87171', fontWeight: '600' }}>¡Atención! Se detectaron discrepancias en los totales de UTM entre motores.</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: '#f87171', display: 'block' }}>Diferencia Principal</span>
                            <span style={{ fontWeight: '700' }}>{(pgTotals.principal - mariaTotals.principal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.7rem', color: '#f87171', display: 'block' }}>Diferencia Secundaria</span>
                            <span style={{ fontWeight: '700' }}>{(pgTotals.secondary - mariaTotals.secondary).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = `
    .rubros-comparison-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
    }

    @media (max-width: 1200px) {
        .rubros-comparison-grid {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 768px) {
        .rubros-container {
            padding: 1rem !important;
            height: auto !important;
            overflow-y: visible !important;
        }

        .header-section {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 1.5rem;
        }

        form {
            width: 100%;
            flex-direction: column;
        }

        form input {
            width: 100% !important;
        }

        .calc-modal-grid {
            grid-template-columns: 1fr !important;
        }
    }
`;

// Add styles to head
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}

export default RubrosComparison;
