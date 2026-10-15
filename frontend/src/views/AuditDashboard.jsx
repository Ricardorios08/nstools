import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, Users, CreditCard, AlertTriangle, CheckCircle2,
    ArrowUpRight, ArrowDownRight, TrendingDown, BarChart3, PieChart,
    ChevronRight, Info, Filter, ArrowRight, RefreshCw, X, Code2
} from 'lucide-react';
import API_BASE_URL from '../config';

const SQL_QUERIES = {
    accounts: {
        title: "Consulta de Cuentas Migradas",
        sql: `/* PostgreSQL - GenRentas */
SELECT tpotribcod as id, COUNT(*) as count 
FROM tributo 
GROUP BY tpotribcod;`
    },
    mariaDebt: {
        title: "Consulta de Deuda InfoGov (MariaDB)",
        sql: `/* MariaDB - InfoGov (Unificado) */
SELECT CodiOfic as id, SUM(DebeCtct - CredCtct) as pending 
FROM ctacte 
WHERE DebeCtct > CredCtct
GROUP BY CodiOfic;`
    },
    postgresDebt: {
        title: "Consulta de Deuda GenRentas (PostgreSQL)",
        sql: `/* PostgreSQL - GenRentas */
SELECT t.tpotribcod as id, 
       SUM(genctaimpcta) as capital, 
       SUM(genctaintpcta) as interest
FROM generacioncuota g
JOIN tributo t ON g.genctatribcod = t.tribcod
WHERE NOT EXISTS (
    SELECT 1 FROM cuentacorriente cc 
    WHERE cc.genctacod = g.genctacod 
    AND cc.cabpgoctactecod != 0
)
GROUP BY t.tpotribcod;`
    },
    difference: {
        title: "Lógica de Diferencia",
        sql: `/* Lógica Aplicada en Backend */
Diferencia = Valor_MariaDB - (Capital_PG + Interes_PG)`
    },
    recaudadores: {
        title: "Consulta de Recaudadores (Apremios)",
        sql: `/* MariaDB - InfoGov */
SELECT r.CodiReca, r.DetaReca, 
       COUNT(a.NumeApre) as CantApremios,
       SUM(a.TotaApre) as TotalApre
FROM recaudador r
LEFT JOIN apremio a ON r.CodiReca = a.CodiReca
WHERE a.CancApre = 0 OR a.NumeApre IS NULL
GROUP BY r.CodiReca, r.DetaReca;`
    }
};

const AuditDashboard = () => {
    const [summary, setSummary] = useState([]);
    const [recaudadores, setRecaudadores] = useState([]);
    const [gcList, setGcList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [auditStatus, setAuditStatus] = useState('idle');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [startTime, setStartTime] = useState(null);
    const [error, setError] = useState(null);
    const [sqlModal, setSqlModal] = useState({ show: false, key: '' });
    const [gcModal, setGcModal] = useState(false);

    useEffect(() => {
        let interval;

        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/dashboard/status`);
                const state = await res.json();

                setAuditStatus(state.status);
                if (state.lastUpdated) setLastUpdated(new Date(state.lastUpdated));
                if (state.startTime) setStartTime(new Date(state.startTime));

                // Merge data
                if (state.summary.length > 0) {
                    const merged = state.summary.map(item => {
                        const d = state.debt.find(debt => debt.id === item.id);
                        return d ? { ...item, ...d, difference: Math.abs(d.mariaPending - d.postgresTotal) } : item;
                    });
                    setSummary(merged);
                    setLoading(false);
                }

                if (state.recaudadores.length > 0) {
                    setRecaudadores(state.recaudadores);
                }

                if (state.gc && state.gc.length > 0) {
                    setGcList(state.gc);
                }

                if (state.status === 'idle' && state.summary.length === 0) {
                    setLoading(false); 
                }

                if (state.status === 'ready') {
                    clearInterval(interval);
                }
            } catch (err) {
                console.error("Error polling dashboard status:", err);
            }
        };

        checkStatus();
        interval = setInterval(checkStatus, 3000);

        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (val) => {
        if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return null;
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    };

    const handleRefresh = async () => {
        if (auditStatus === 'calculating') return;
        try {
            setAuditStatus('calculating');
            await fetch(`${API_BASE_URL}/api/dashboard/calculate?force=true`, { method: 'POST' });
        } catch (err) {
            console.error("Error triggering refresh:", err);
        }
    };

    if (loading && summary.length === 0 && auditStatus !== 'idle') return (
        <div className="view-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="spinner"></div>
            <div style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
                <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Procesando Auditoría Masiva</h3>
                <p>Estamos analizando millones de registros en tiempo real.<br />Esto puede tardar unos segundos...</p>
            </div>
        </div>
    );

    if (summary.length === 0 && auditStatus === 'idle') return (
        <div className="view-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(37, 99, 235, 0.2)', textAlign: 'center', maxWidth: '500px' }}>
                <LayoutDashboard size={48} color="var(--primary)" style={{ marginBottom: '1.5rem' }} />
                <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Auditoría de Conciliación</h2>
                <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', lineHeight: '1.6' }}>
                    Este panel permite comparar la integridad de la deuda entre MariaDB y PostgreSQL. 
                    Debido a la gran cantidad de datos, el cálculo debe iniciarse manualmente.
                </p>
                <button 
                    onClick={handleRefresh}
                    className="btn btn-primary"
                    style={{ padding: '1rem 2rem', fontSize: '1rem', fontWeight: 'bold', borderRadius: '12px' }}
                >
                    Iniciar Auditoría General
                </button>
            </div>
        </div>
    );

    const totalAccounts = summary.reduce((acc, curr) => acc + (curr.accountsMigrated || 0), 0);
    const totalMariaDebt = summary.reduce((acc, curr) => acc + (curr.mariaPending || 0), 0);
    const totalPgDebt = summary.reduce((acc, curr) => acc + (curr.postgresTotal || 0), 0);
    const globalDiff = Math.abs(totalMariaDebt - totalPgDebt);
    const diffPercent = totalMariaDebt > 0 ? (globalDiff / totalMariaDebt) * 100 : 0;


    return (
        <div className="view-container" style={{ padding: '2rem', background: '#0a0b10', overflowY: 'auto', height: '100%' }}>
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: '8px', color: 'white' }}>
                            <LayoutDashboard size={20} />
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', margin: 0 }}>Panel de Auditoría de Migración (En desarrollo no usar)</h1>

                        {/* Status Badge */}
                        <div style={{
                            marginLeft: '1rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: auditStatus === 'calculating' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: auditStatus === 'calculating' ? '#3b82f6' : '#10b981',
                            border: `1px solid ${auditStatus === 'calculating' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                        }}>
                            {auditStatus === 'calculating' ? (
                                <><div className="dot-pulse"></div> PROCESANDO HILO...</>
                            ) : (
                                <><CheckCircle2 size={12} /> DATOS ACTUALIZADOS</>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        {startTime && (
                            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ opacity: 0.6 }}>Iniciado:</span>
                                <span style={{ color: auditStatus === 'calculating' ? 'var(--primary)' : 'inherit', fontWeight: auditStatus === 'calculating' ? '600' : '400' }}>
                                    {startTime.toLocaleTimeString()}
                                </span>
                            </p>
                        )}
                        {lastUpdated && (
                            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ opacity: 0.6 }}>Finalizado:</span>
                                {lastUpdated.toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={auditStatus === 'calculating'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.25rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        color: '#fff',
                        cursor: auditStatus === 'calculating' ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                    }}
                    onMouseOver={(e) => { if (auditStatus !== 'calculating') e.target.style.background = 'rgba(255, 255, 255, 0.1)'; }}
                    onMouseOut={(e) => { if (auditStatus !== 'calculating') e.target.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                >
                    <RefreshCw size={18} className={auditStatus === 'calculating' ? 'spin-icon' : ''} />
                    {auditStatus === 'calculating' ? 'Recalculando...' : 'Recalcular Todo'}
                </button>
            </header>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard
                    title="Cuentas Migradas"
                    value={totalAccounts.toLocaleString()}
                    sub="Total en GenRentas"
                    icon={<Users size={24} />}
                    color="var(--primary)"
                    onClick={() => setSqlModal({ show: true, key: 'accounts' })}
                />
                <StatCard
                    title="Deuda Pendiente (MD)"
                    value={formatCurrency(totalMariaDebt)}
                    sub="InfoGov Original"
                    icon={<CreditCard size={24} />}
                    color="#7c4dff"
                    loading={auditStatus === 'calculating' && totalMariaDebt === 0}
                    onClick={() => setSqlModal({ show: true, key: 'mariaDebt' })}
                />
                <StatCard
                    title="Deuda Pendiente (PG)"
                    value={formatCurrency(totalPgDebt)}
                    sub="PostgreSQL Migrado"
                    icon={<CreditCard size={24} />}
                    color="#10b981"
                    loading={auditStatus === 'calculating' && totalPgDebt === 0}
                    onClick={() => setSqlModal({ show: true, key: 'postgresDebt' })}
                />
                <StatCard
                    title="Diferencia de Deuda"
                    value={formatCurrency(globalDiff)}
                    sub={`${diffPercent.toFixed(2)}% de desvío`}
                    icon={<AlertTriangle size={24} />}
                    color={diffPercent > 1 ? "#ef4444" : "#f59e0b"}
                    loading={auditStatus === 'calculating' && globalDiff === 0}
                    onClick={() => setSqlModal({ show: true, key: 'difference' })}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                {/* Breakdown by Tribute */}
                <section className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Filter size={18} color="var(--primary)" />
                            Desglose por Tributo
                        </h2>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Tributo</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-dim)' }}>Padrones (MD/PG)</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: '#7c4dff' }}>Cap. MD</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: '#7c4dff', opacity: 0.7 }}>Int. MD</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: '#10b981' }}>Cap. PG</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: '#10b981', opacity: 0.7 }}>Int. PG</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: '#fff' }}>Dif. Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.map(item => {
                                    const accountDiff = (item.accountsMaria || 0) - (item.accountsMigrated || 0);
                                    return (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                                            <td style={{ padding: '1rem', fontWeight: '700', color: '#fff', fontSize: '0.85rem' }}>{item.name}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                                    <span style={{ opacity: 0.6 }}>{(item.accountsMaria || 0).toLocaleString()}</span>
                                                    <ArrowRight size={12} style={{ opacity: 0.3 }} />
                                                    <span style={{ fontWeight: '700', color: accountDiff === 0 ? '#10b981' : '#f59e0b' }}>
                                                        {(item.accountsMigrated || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: '#7c4dff' }}>{formatCurrency(item.mariaCapital)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: '#7c4dff', opacity: 0.7, fontSize: '0.75rem' }}>{formatCurrency(item.mariaInterest)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981' }}>{formatCurrency(item.postgresCapital)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981', opacity: 0.7, fontSize: '0.75rem' }}>{formatCurrency(item.postgresInterest)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: item.difference > 1000 ? '#ef4444' : '#fff' }}>
                                                {formatCurrency(item.difference)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Loss of Collector Analysis */}
                    <section className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <TrendingDown size={18} color="#ef4444" />
                                Análisis de Recaudadores (Apremios)
                            </h2>
                            <button 
                                onClick={() => setSqlModal({ show: true, key: 'recaudadores' })}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                            >
                                <Code2 size={16} />
                            </button>
                        </div>


                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {recaudadores.slice(0, 5).map((reca, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                        {i + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{reca.DetaReca}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{reca.CantApremios} apremios activos</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: '700', color: '#10b981' }}>{formatCurrency(reca.TotalApre)}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Cartera Total</div>
                                    </div>
                                </div>
                            ))}
                            {recaudadores.length > 5 && (
                                <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    Ver todos los recaudadores <ArrowRight size={14} />
                                </button>
                            )}
                        </div>
                    </section>

                    {/* Grandes Contribuyentes card */}
                    <section 
                        className="card" 
                        onClick={() => setGcModal(true)}
                        style={{ 
                            background: 'linear-gradient(45deg, rgba(37, 99, 235, 0.1), rgba(124, 77, 255, 0.1))', 
                            border: '1px solid rgba(124, 77, 255, 0.3)', 
                            borderRadius: '16px', 
                            padding: '1.5rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '1.5rem',
                            cursor: 'pointer',
                            transition: 'transform 0.2s'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ background: 'var(--primary)', padding: '1rem', borderRadius: '12px', color: 'white' }}>
                            <BarChart3 size={32} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>Top 20 Grandes Contribuyentes</h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>Comparativa de carteras con mayor deuda acumulada.</p>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.5 }}>Deuda MD</div>
                                    <div style={{ fontWeight: '700', color: 'white' }}>
                                        {formatCurrency(gcList.reduce((acc, c) => acc + c.mdDebt, 0))}
                                    </div>
                                </div>
                                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.5 }}>Deuda PG</div>
                                    <div style={{ fontWeight: '700', color: 'var(--primary)' }}>
                                        {formatCurrency(gcList.reduce((acc, c) => acc + c.pgDebt, 0))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <ChevronRight size={24} style={{ opacity: 0.3 }} />
                    </section>
                </div>
            </div>

            {sqlModal.show && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem'
                }} onClick={() => setSqlModal({ show: false, key: '' })}>
                    <div style={{
                        background: '#1a1b23',
                        border: '1px solid var(--border)',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '800px',
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary)' }}>
                                    <Code2 size={20} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{SQL_QUERIES[sqlModal.key]?.title}</h3>
                            </div>
                            <button 
                                onClick={() => setSqlModal({ show: false, key: '' })}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                            <pre style={{ 
                                background: '#0a0b10', 
                                padding: '1.5rem', 
                                borderRadius: '12px', 
                                color: '#10b981', 
                                fontSize: '0.9rem',
                                lineHeight: '1.6',
                                overflowX: 'auto',
                                border: '1px solid rgba(16, 185, 129, 0.1)',
                                fontFamily: 'Fira Code, monospace'
                            }}>
                                <code>{SQL_QUERIES[sqlModal.key]?.sql}</code>
                            </pre>
                            <div style={{ marginTop: '1.5rem', color: 'var(--text-dim)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <Info size={16} />
                                <p style={{ margin: 0 }}>Esta es la lógica exacta que el trabajador en segundo plano está ejecutando para conciliar los datos históricos.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {gcModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem'
                }} onClick={() => setGcModal(false)}>
                    <div style={{
                        background: '#1a1b23',
                        border: '1px solid var(--border)',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '1000px',
                        maxHeight: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary)' }}>
                                    <BarChart3 size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Comparativa: Top 20 Grandes Contribuyentes</h3>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)' }}>Auditoría detallada por CUIT (MariaDB vs PostgreSQL)</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setGcModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ padding: '0', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#1a1b23', zIndex: 10 }}>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Contribuyente / CUIT</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-dim)' }}>Deuda MD</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-dim)' }}>Deuda PG</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-dim)' }}>Diferencia</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-dim)' }}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gcList.map((gc, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: '600', color: '#fff' }}>{gc.name}</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>CUIT: {gc.cuit}</div>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: '#7c4dff' }}>{formatCurrency(gc.mdDebt)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981' }}>{formatCurrency(gc.pgDebt)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: gc.diff > 100 ? '#ef4444' : '#fff' }}>
                                                {formatCurrency(gc.diff)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{ 
                                                    padding: '0.2rem 0.5rem', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.65rem', 
                                                    fontWeight: '700',
                                                    background: gc.diff < 10 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: gc.diff < 10 ? '#10b981' : '#ef4444'
                                                }}>
                                                    {gc.diff < 10 ? 'CONCILIADO' : 'DESVÍO'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                            Mostrando los 20 mayores deudores detectados por capital en GenRentas (PG).
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(255, 255, 255, 0.1);
                    border-top: 4px solid var(--primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .dot-pulse {
                    width: 8px;
                    height: 8px;
                    background: #3b82f6;
                    border-radius: 50%;
                    animation: pulse 1s infinite ease-in-out;
                }
                @keyframes pulse {
                    0% { transform: scale(0.8); opacity: 0.5; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(0.8); opacity: 0.5; }
                }
                .spin-icon {
                    animation: spin 2s linear infinite;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}} />
        </div>
    );
};

const StatCard = ({ title, value, sub, icon, color, loading, onClick }) => (
    <div 
        onClick={onClick}
        style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
    }}
    onMouseOver={(e) => { if (onClick) e.currentTarget.style.transform = 'translateY(-4px)'; }}
    onMouseOut={(e) => { if (onClick) e.currentTarget.style.transform = 'translateY(0)'; }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: '500' }}>{title}</span>
                {loading ? (
                    <div style={{ height: '2.5rem', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '60%', height: '1.2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite linear' }}></div>
                    </div>
                ) : (
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.5rem 0', color: '#fff' }}>{value || '0'}</div>
                )}
            </div>
            <div style={{ background: `rgba(${color === 'var(--primary)' ? '37, 99, 235' : '124, 77, 255'}, 0.1)`, padding: '0.75rem', borderRadius: '12px', color: color }}>
                {icon}
            </div>
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Info size={12} />
            {loading ? 'Calculando...' : sub}
        </div>
        {/* Glow effect */}
        <div style={{
            position: 'absolute',
            bottom: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: color,
            opacity: 0.05,
            filter: 'blur(40px)',
            borderRadius: '50%'
        }}></div>
    </div>
);

export default AuditDashboard;
