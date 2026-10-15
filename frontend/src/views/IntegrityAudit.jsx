import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, AlertCircle, Database, Search, 
    ArrowRight, RefreshCw, User, ClipboardList,
    CheckCircle2, XCircle, Info
} from 'lucide-react';
import API_BASE_URL from '../config';

const IntegrityAudit = () => {
    const [offices, setOffices] = useState([]);
    const [selectedOffice, setSelectedOffice] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchOffices();
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

    const handleRunAudit = async () => {
        if (!selectedOffice) return;
        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const res = await fetch(`${API_BASE_URL}/api/audit/missing-parity?officeId=${selectedOffice}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResults(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="view-container" style={{ padding: '2rem', background: '#0a0b10', overflowY: 'auto', height: '100%' }}>
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div style={{ background: '#7c4dff', padding: '0.6rem', borderRadius: '12px', color: 'white' }}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', margin: 0 }}>Auditoría de Integridad de Padrones</h1>
                        <p style={{ color: 'var(--text-dim)', margin: 0 }}>Detección de asimetrías entre MariaDB (Legacy) y PostgreSQL (Nuevo)</p>
                    </div>
                </div>
            </header>

            <section className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <label style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>Seleccionar Oficina / Tributo</label>
                        <select 
                            value={selectedOffice} 
                            onChange={(e) => setSelectedOffice(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '0.75rem', 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '10px', 
                                color: 'white',
                                fontSize: '1rem'
                            }}
                        >
                            {offices.map(off => <option key={off.id} value={off.id}>{off.name} ({off.id})</option>)}
                        </select>
                    </div>
                    <button 
                        onClick={handleRunAudit}
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ 
                            padding: '0.75rem 2rem', 
                            borderRadius: '10px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            fontWeight: '700',
                            height: '45px'
                        }}
                    >
                        {loading ? <RefreshCw size={18} className="spin-icon" /> : <Search size={18} />}
                        {loading ? 'Analizando...' : 'Ejecutar Auditoría de Paridad'}
                    </button>
                </div>
            </section>

            {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {results && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Padrones en MariaDB</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>{results.summary.totalMaria.toLocaleString()}</div>
                        </div>
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Padrones en Postgres</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>{results.summary.totalPostgres.toLocaleString()}</div>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '1.5rem' }}>
                            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>Faltantes en Postgres</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444' }}>{results.summary.missingInPostgresCount.toLocaleString()}</div>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', padding: '1.5rem' }}>
                            <div style={{ color: '#f59e0b', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>No están en MariaDB</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#f59e0b' }}>{results.summary.missingInMariaCount.toLocaleString()}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Missing in Postgres List */}
                        <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239, 68, 68, 0.05)' }}>
                                <XCircle size={18} color="#ef4444" />
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>En MariaDB pero NO en Postgres</h3>
                            </div>
                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)' }}>Padrón</th>
                                            <th style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)' }}>Nombre (Titular)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.missingInPostgres.length > 0 ? results.missingInPostgres.map((item, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: 'var(--primary)' }}>{item.account}</td>
                                                <td style={{ padding: '0.75rem 1rem', color: '#fff' }}>{item.name}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>No se detectaron faltantes.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {results.summary.missingInPostgresCount > 100 && (
                                <div style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                    Mostrando los primeros 100 de {results.summary.missingInPostgresCount} registros.
                                </div>
                            )}
                        </div>

                        {/* Missing in MariaDB List */}
                        <div className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(245, 158, 11, 0.05)' }}>
                                <AlertCircle size={18} color="#f59e0b" />
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>En Postgres pero NO en MariaDB</h3>
                            </div>
                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)' }}>Padrón</th>
                                            <th style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)' }}>Nombre en Postgres</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.missingInMaria.length > 0 ? results.missingInMaria.map((item, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#f59e0b' }}>{item.account}</td>
                                                <td style={{ padding: '0.75rem 1rem', color: '#fff' }}>{item.name}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>No se detectaron huérfanos.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {results.summary.missingInMariaCount > 100 && (
                                <div style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                    Mostrando los primeros 100 de {results.summary.missingInMariaCount} registros.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {!results && !loading && (
                <div style={{ textAlign: 'center', padding: '5rem 0', opacity: 0.5 }}>
                    <ClipboardList size={64} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                    <p>Seleccione una oficina y presione "Ejecutar Auditoría" para comenzar el análisis.</p>
                </div>
            )}
        </div>
    );
};

export default IntegrityAudit;
