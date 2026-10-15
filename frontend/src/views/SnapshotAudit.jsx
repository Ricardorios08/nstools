import React, { useState, useEffect } from 'react';
import { 
    History, Play, CheckCircle, AlertTriangle, 
    Database, Search, Filter, RefreshCw,
    XCircle, Info, Clock, BarChart4, List
} from 'lucide-react';
import API_BASE_URL from '../config';

const SnapshotAudit = () => {
    const [offices, setOffices] = useState([]);
    const [selectedOffice, setSelectedOffice] = useState('');
    const [status, setStatus] = useState(null);
    const [report, setReport] = useState([]);
    const [activeTab, setActiveTab] = useState('report'); // report, maria, postgres, combined
    const [onlyDiff, setOnlyDiff] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        fetchOffices();
        checkStatus();
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchOffices = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/ctacte-fn/offices`);
            const data = await res.json();
            setOffices(data);
            if (data.length > 0) setSelectedOffice(data[0].id.toString());
        } catch (err) {
            console.error('Error fetching offices:', err);
        }
    };

    const checkStatus = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/audit-snapshot/status`);
            const data = await res.json();
            setStatus(data);
            setRunning(data.status === 'running');
        } catch (err) {
            console.error('Error checking status:', err);
        }
    };

    const handleStartSnapshot = async () => {
        try {
            await fetch(`${API_BASE_URL}/api/audit-snapshot/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ officeId: selectedOffice })
            });
            checkStatus();
        } catch (err) {
            console.error('Error starting snapshot:', err);
        }
    };

    const fetchTabData = async (tab = activeTab) => {
        if (!selectedOffice) return;
        setLoading(true);
        try {
            let endpoint = '';
            if (tab === 'report') endpoint = `/api/audit-snapshot/report?officeId=${selectedOffice}`;
            else if (tab === 'maria') endpoint = `/api/audit-snapshot/list-maria?officeId=${selectedOffice}`;
            else if (tab === 'postgres') endpoint = `/api/audit-snapshot/list-postgres?officeId=${selectedOffice}`;
            else if (tab === 'combined') endpoint = `/api/audit-snapshot/list-combined?officeId=${selectedOffice}${onlyDiff ? '&onlyDiff=true' : ''}`;
            
            const res = await fetch(`${API_BASE_URL}${endpoint}`);
            const data = await res.json();
            setReport(data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        fetchTabData(tab);
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
    };

    return (
        <div className="view-container" style={{ padding: '2rem', background: '#0a0b10', overflowY: 'auto', height: '100%' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'var(--primary)', padding: '0.6rem', borderRadius: '12px', color: 'white' }}>
                        <History size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', margin: 0 }}>Auditoría por Listados Históricos</h1>
                        <p style={{ color: 'var(--text-dim)', margin: 0 }}>Comparación masiva basada en tablas de snapshot locales</p>
                    </div>
                </div>

                {status && (
                    <div style={{ 
                        background: 'rgba(255,255,255,0.03)', 
                        padding: '0.75rem 1.25rem', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Estado del Proceso</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: running ? 'var(--primary)' : '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {running && <RefreshCw size={14} className="spin-icon" />}
                                {running ? `Procesando: ${status.currentOffice} (${status.progress}%)` : 'Sistema en Reposo'}
                            </div>
                        </div>
                        {status.lastFinished && !running && (
                            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Última Actualización</div>
                                <div style={{ fontSize: '0.9rem', color: '#fff' }}>{new Date(status.lastFinished).toLocaleTimeString()}</div>
                            </div>
                        )}
                    </div>
                )}
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
                {/* Control Panel */}
                <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Database size={18} color="var(--primary)" /> Configuración
                        </h3>
                        
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Oficina / Tributo</label>
                            <select 
                                value={selectedOffice} 
                                onChange={(e) => setSelectedOffice(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff' }}
                            >
                                {offices.map(off => <option key={off.id} value={off.id}>{off.name}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button 
                                onClick={handleStartSnapshot}
                                disabled={running}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}
                            >
                                <Play size={18} /> Regenerar Listado Local
                            </button>
                            <button 
                                onClick={() => setShowSqlModal(true)}
                                style={{ 
                                    width: '100%', 
                                    padding: '0.8rem', 
                                    borderRadius: '10px', 
                                    background: 'rgba(59, 130, 246, 0.1)', 
                                    border: '1px solid rgba(59, 130, 246, 0.2)', 
                                    color: '#3b82f6', 
                                    fontSize: '0.8rem',
                                    fontWeight: '700', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    justifyContent: 'center'
                                }}
                            >
                                <Info size={18} /> Ver Lógica de Consultas (SQL)
                            </button>
                            <button 
                                onClick={() => handleTabChange('report')}
                                disabled={running || !selectedOffice}
                                style={{ 
                                    width: '100%', 
                                    padding: '0.8rem', 
                                    borderRadius: '10px', 
                                    background: activeTab === 'report' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                                    border: '1px solid var(--border)', 
                                    color: '#fff', 
                                    fontWeight: '700', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    justifyContent: 'center'
                                }}
                            >
                                <BarChart4 size={18} /> Ver Diferencias
                            </button>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <button 
                                    onClick={() => handleTabChange('maria')}
                                    disabled={running || !selectedOffice}
                                    style={{ 
                                        padding: '0.8rem', 
                                        borderRadius: '10px', 
                                        background: activeTab === 'maria' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)', 
                                        border: activeTab === 'maria' ? '1px solid #3b82f6' : '1px solid var(--border)', 
                                        color: '#fff', 
                                        fontSize: '0.75rem',
                                        fontWeight: '700', 
                                        cursor: 'pointer' 
                                    }}
                                >
                                    Listado MariaDB
                                </button>
                                <button 
                                    onClick={() => handleTabChange('postgres')}
                                    disabled={running || !selectedOffice}
                                    style={{ 
                                        padding: '0.8rem', 
                                        borderRadius: '10px', 
                                        background: activeTab === 'postgres' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)', 
                                        border: activeTab === 'postgres' ? '1px solid #3b82f6' : '1px solid var(--border)', 
                                        color: '#fff', 
                                        fontSize: '0.75rem',
                                        fontWeight: '700', 
                                        cursor: 'pointer' 
                                    }}
                                >
                                    Listado Postgres
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => handleTabChange('combined')}
                                disabled={running || !selectedOffice}
                                style={{ 
                                    width: '100%', 
                                    padding: '0.8rem', 
                                    borderRadius: '10px', 
                                    background: activeTab === 'combined' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', 
                                    border: activeTab === 'combined' ? '1px solid #10b981' : '1px solid var(--border)', 
                                    color: '#fff', 
                                    fontSize: '0.8rem',
                                    fontWeight: '700', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    justifyContent: 'center'
                                }}
                            >
                                <Database size={18} /> Vista Combinada (M/P)
                            </button>

                            {activeTab === 'combined' && (
                                <div style={{ 
                                    marginTop: '0.5rem', 
                                    padding: '0.75rem', 
                                    background: 'rgba(239, 68, 68, 0.05)', 
                                    borderRadius: '10px', 
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer'
                                }} onClick={() => { setOnlyDiff(!onlyDiff); setTimeout(() => fetchTabData('combined'), 0); }}>
                                    <input 
                                        type="checkbox" 
                                        checked={onlyDiff} 
                                        onChange={() => {}} 
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <label style={{ fontSize: '0.8rem', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Solo con Diferencias</label>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ padding: '1.25rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', color: '#3b82f6' }}>
                            <Info size={20} />
                            <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                                Esta herramienta crea una copia resumida de las deudas en la base local <code>user</code>. 
                                Úsela para comparar grandes volúmenes de datos sin afectar el rendimiento de los sistemas de producción.
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Results Table */}
                <main className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                            {activeTab === 'report' ? 'Diferencias Detectadas en Snapshots' : 
                             activeTab === 'maria' ? 'Listado Completo - MariaDB (Local)' : 
                             activeTab === 'postgres' ? 'Listado Completo - PostgreSQL (Nuevo)' :
                             'Vista Comparativa Combinada (Union All)'}
                        </h3>
                        {report.length > 0 && (
                            <span style={{ 
                                background: activeTab === 'report' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                                color: activeTab === 'report' ? '#ef4444' : '#3b82f6', 
                                padding: '0.25rem 0.75rem', 
                                borderRadius: '20px', 
                                fontSize: '0.75rem', 
                                fontWeight: '700' 
                            }}>
                                {report.length === 2000 ? '2000+ registros' : `${report.length} registros`}
                            </span>
                        )}
                    </div>

                    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#1a1b23', zIndex: 10 }}>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                    {activeTab === 'combined' && <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'center' }}>S</th>}
                                    <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Cuenta / Padrón</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Persona (Percod / Nombre)</th>
                                    {activeTab === 'report' ? (
                                        <>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'right' }}>Total MariaDB</th>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'right' }}>Total Postgres</th>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'right' }}>Diferencia</th>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'center' }}>Tipo de Error</th>
                                        </>
                                    ) : (
                                        <>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'right' }}>Capital</th>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'right' }}>Interés</th>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'right' }}>Total</th>
                                            <th style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'center' }}>Sincronizado</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
                                ) : report.length > 0 ? report.map((r, i) => (
                                    <tr key={i} style={{ 
                                        borderBottom: '1px solid rgba(255,255,255,0.02)', 
                                        transition: 'background 0.2s',
                                        background: activeTab === 'combined' && r.sistema === 'M' ? 'rgba(59, 130, 246, 0.02)' : 'transparent'
                                    }} className="table-row-hover">
                                        {activeTab === 'combined' && (
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{ 
                                                    background: r.sistema === 'M' ? '#3b82f6' : '#8b5cf6', 
                                                    color: '#fff', 
                                                    padding: '0.1rem 0.4rem', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.7rem', 
                                                    fontWeight: '800' 
                                                }}>
                                                    {r.sistema}
                                                </span>
                                            </td>
                                        )}
                                        <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--primary)' }}>{r.cuenta}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '600' }}>{r.nombre || 'N/A'}</div>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Cod: {r.percod || 'N/A'}</div>
                                        </td>
                                        
                                        {activeTab === 'report' ? (
                                            <>
                                                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-dim)' }}>{formatCurrency(r.maria_total)}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', color: '#fff' }}>{formatCurrency(r.pg_total)}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(r.diff)}</td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <span style={{ 
                                                        padding: '0.2rem 0.6rem', 
                                                        borderRadius: '4px', 
                                                        fontSize: '0.65rem', 
                                                        fontWeight: '700',
                                                        background: r.type === 'Balance Mismatch' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                        color: r.type === 'Balance Mismatch' ? '#f59e0b' : '#ef4444'
                                                    }}>
                                                        {r.type.toUpperCase()}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-dim)' }}>{formatCurrency(r.capital)}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-dim)' }}>{formatCurrency(r.interes)}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', color: '#fff', fontWeight: '700' }}>{formatCurrency(r.total)}</td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                                                        {new Date(r.fecha_actualizacion).toLocaleDateString()}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                                            {activeTab === 'report' ? <CheckCircle size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} /> : <List size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />}
                                            <p>No hay datos para mostrar en este listado. Asegúrese de haber generado el snapshot.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>

            {/* SQL Modal */}
            {showSqlModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2rem'
                }} onClick={() => setShowSqlModal(false)}>
                    <div style={{
                        background: '#1a1b23', borderRadius: '20px', border: '1px solid var(--border)',
                        maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'auto',
                        padding: '2rem'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, color: '#fff' }}>Lógica de Consultas SQL (Snapshots)</h2>
                            <button onClick={() => setShowSqlModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><XCircle size={24} /></button>
                        </div>

                        <div style={{ display: 'grid', gap: '2rem' }}>
                            <div>
                                <h4 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Database size={18}/> MariaDB (Legacy) - Titulares y Deuda</h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                                    Para el nombre, usa <code>vpadrones_persona</code> (principal='SI'). Para la deuda, suma <code>ctacte</code> y los planes activos en <code>facipago/detafapa</code>.
                                </p>
                                <pre style={{ background: '#000', padding: '1rem', borderRadius: '10px', fontSize: '0.8rem', color: '#10b981', overflow: 'auto' }}>
{`-- Consulta de CtaCte
SELECT t.CuenCtct, t.FeveCtct, SUM(t.DebeCtct - t.CredCtct) as capital
FROM ctacte t WHERE t.CodiOfic = ? GROUP BY t.CuenCtct, t.FeveCtct;

-- Consulta de Planes (facipago)
SELECT f.CuenCtct, d.FeveDefa, SUM(d.TotaDefa) as capital
FROM facipago f INNER JOIN detafapa d ON d.CodiFapa = f.CodiFapa
WHERE f.CodiOfic = ? AND f.EstaFapa = 'Activa' AND d.FepaDefa IS NULL
GROUP BY f.CuenCtct, d.FeveDefa;`}
                                </pre>
                            </div>

                            <div>
                                <h4 style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Database size={18}/> PostgreSQL (Migrado) - Titulares y Deuda</h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                                    Obtiene la deuda de <code>cuentacorriente</code> vinculada a <code>generacioncuota</code>, filtrando por tributo/oficina.
                                </p>
                                <pre style={{ background: '#000', padding: '1rem', borderRadius: '10px', fontSize: '0.8rem', color: '#10b981', overflow: 'auto' }}>
{`SELECT t.tbecod, p.percod, p.pernom, gc.genctafchvto, SUM(gc.genctaimpcta)
FROM public.cuentacorriente cc
INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
INNER JOIN public.persona p ON gc.genctapercod = p.percod
WHERE t.tpotribcod = ? AND (cc.cabpgoctactecod IS NULL OR cc.cabpgoctactecod = 0)
GROUP BY t.tbecod, p.percod, p.pernom, gc.genctafchvto`}
                                </pre>
                            </div>

                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '1rem' }}>
                                <h4 style={{ color: '#10b981', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><List size={18}/> Vista Combinada (UNION ALL)</h4>
                                <pre style={{ background: '#000', padding: '1rem', borderRadius: '10px', fontSize: '0.75rem', color: '#10b981', overflow: 'auto', margin: 0 }}>
{`SELECT 'M' as sistema, cuenta, percod, nombre, capital, interes, total
FROM listado_historico_mariadb WHERE office_id = ?
UNION ALL
SELECT 'P' as sistema, cuenta, percod, nombre, capital, interes, total
FROM listado_historico_postgres WHERE office_id = ?
ORDER BY cuenta, sistema`}
                                </pre>
                            </div>

                            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.5rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={18}/> Inconsistencia Detectada</h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: 0 }}>
                                    Si ves nombres distintos o capitales que no coinciden (como en la cuenta 75503), el sistema de auditoría está resaltando que las bases de datos tienen información contradictoria o que falta migrar planes de pago.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{ __html: `
                .table-row-hover:hover { background: rgba(255,255,255,0.02); }
                .spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .spin-icon { animation: spin 2s linear infinite; }
            `}} />
        </div>
    );
};

export default SnapshotAudit;
