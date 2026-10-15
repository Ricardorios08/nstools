import React, { useState, useEffect } from 'react';
import { 
    Search, FileText, Download, CheckCircle2, AlertCircle, 
    ArrowRight, Clipboard, X, Eye, Info, CreditCard, 
    History, LayoutGrid, Filter, Database, HelpCircle
} from 'lucide-react';
import API_BASE_URL from '../config';
import PostgresCedulaModal from '../components/PostgresCedulaModal';

const Apremios = () => {
    const [selectedGrNumeApre, setSelectedGrNumeApre] = useState(null);
    const [data, setData] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [pendingIds, setPendingIds] = useState([]);
    const [copyLoading, setCopyLoading] = useState(false);
    const [error, setError] = useState(null);
    const [officeId, setOfficeId] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [limit, setLimit] = useState(100);
    const [skip, setSkip] = useState(0);
    const [total, setTotal] = useState(0);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('nomade_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const [offices, setOffices] = useState([]);

    // Cta-Cte Modal States
    const [showCtaCteModal, setShowCtaCteModal] = useState(false);
    const [ctaCtePerson, setCtaCtePerson] = useState(null);
    const [ctaCteOffices, setCtaCteOffices] = useState([]);
    const [activeCtaCteOffice, setActiveCtaCteOffice] = useState(null);
    const [ctaCteData, setCtaCteData] = useState({ legacy: [], postgres: [] });
    const [ctaCteLoading, setCtaCteLoading] = useState(false);
    const [ctaCteTab, setCtaCteTab] = useState('debt');
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualContent, setManualContent] = useState('');

    useEffect(() => {
        // Fetch offices for filtering
        fetch(`${API_BASE_URL}/api/ctacte/offices`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => setOffices(data))
            .catch(err => console.error('Error fetching offices:', err));
        
        // Fetch initial stats
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/apremios/stats`, { headers: getAuthHeaders() });
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setStatsLoading(false);
        }
    };

    const handleOpenCopyModal = async () => {
        setShowCopyModal(true);
        setCopyLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/apremios/pending-ids`, { headers: getAuthHeaders() });
            const data = await res.json();
            setPendingIds(data.ids || []);
        } catch (err) {
            console.error('Error fetching pending ids:', err);
        } finally {
            setCopyLoading(false);
        }
    };

    const handleOpenCtaCte = async (percod, name) => {
        setCtaCtePerson({ percod, name });
        setShowCtaCteModal(true);
        setCtaCteLoading(true);
        setCtaCteOffices([]);
        setActiveCtaCteOffice(null);
        setCtaCteData({ legacy: [], postgres: [] });

        try {
            // Get all accounts associated with this percod
            const res = await fetch(`${API_BASE_URL}/api/ctacte/search-person?q=${percod}`, { headers: getAuthHeaders() });
            const data = await res.json();
            
            // Find the person and group their accounts by office
            const person = data.find(p => p.percod === percod);
            if (person && person.accounts && person.accounts.length > 0) {
                const grouped = person.accounts.reduce((acc, curr) => {
                    if (!acc[curr.officeId]) {
                        acc[curr.officeId] = {
                            id: curr.officeId,
                            name: curr.officeName.trim(),
                            accountIds: []
                        };
                    }
                    acc[curr.officeId].accountIds.push(curr.account);
                    return acc;
                }, {});

                const offices = Object.values(grouped);
                setCtaCteOffices(offices);
                setActiveCtaCteOffice(offices[0]);
                fetchCtaCteData(percod, offices[0].id, offices[0].accountIds);
            }
        } catch (err) {
            console.error('Error resolving human-readable offices:', err);
        } finally {
            setCtaCteLoading(false);
        }
    };

    const fetchCtaCteData = async (percod, officeId, accountIds) => {
        if (!accountIds || accountIds.length === 0) return;
        setCtaCteLoading(true);
        
        try {
            // Construct query string for multiple accounts
            const accParams = accountIds.map(id => `account=${id}`).join('&');
            const commonParams = `officeId=${officeId}&${accParams}&onlyDebt=${ctaCteTab === 'debt'}`;

            const [resLegacy, resPostgres] = await Promise.all([
                fetch(`${API_BASE_URL}/api/ctacte/legacy/search?${commonParams}`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE_URL}/api/ctacte/postgres/search?${commonParams}`, { headers: getAuthHeaders() })
            ]);
            
            const legacy = await resLegacy.json();
            const postgres = await resPostgres.json();
            setCtaCteData({ legacy, postgres });
        } catch (err) {
            console.error('Error fetching CtaCte data:', err);
        } finally {
            setCtaCteLoading(false);
        }
    };

    // Auto-refresh CtaCte when tab or office changes
    useEffect(() => {
        if (showCtaCteModal && ctaCtePerson && activeCtaCteOffice) {
            fetchCtaCteData(ctaCtePerson.percod, activeCtaCteOffice.id, activeCtaCteOffice.accountIds);
        }
    }, [ctaCteTab, activeCtaCteOffice, showCtaCteModal]);

    const openManual = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/docs/migration-logic`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (response.ok) {
                setManualContent(data.content);
                setShowManualModal(true);
            }
        } catch (err) {
            console.error('Error fetching manual:', err);
        }
    };

    const handleCopyToClipboard = () => {
        const text = pendingIds.join(',');
        navigator.clipboard.writeText(text).then(() => {
            alert('Copiado al portapapeles!');
        }).catch(err => {
            console.error('Error copying:', err);
        });
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `${API_BASE_URL}/api/apremios/compare?limit=${limit}&skip=${skip}&status=${statusFilter}${officeId ? `&officeId=${officeId}` : ''}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            const result = await res.json();
            
            if (res.ok) {
                setData(result.data || []);
                setTotal(result.total || 0);
            } else {
                setError(result.error || 'Error al obtener datos');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Error de conexión con el servidor');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [skip, limit, officeId, statusFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSkip(0);
        fetchData();
        fetchStats(); // Update stats on manual refresh
    };

    return (
        <div className="view-container">
            <div className="view-header">
                <div className="header-title">
                    <Database size={24} color="#2563eb" />
                    <h1>Panel de Apremios & Cédulas</h1>
                </div>
                <div className="header-actions">
                    <form className="search-bar" onSubmit={handleSearch}>
                        <Filter size={18} />
                        <select 
                            value={officeId} 
                            onChange={(e) => { setOfficeId(e.target.value); setSkip(0); }}
                            className="styled-select"
                        >
                            <option value="">Todas las Oficinas</option>
                            {offices.map(off => (
                                <option key={off.CodiOfic} value={off.CodiOfic}>
                                    {off.CodiOfic} - {off.DetaOfic}
                                </option>
                            ))}
                        </select>

                        <select 
                            value={statusFilter} 
                            onChange={(e) => { setStatusFilter(e.target.value); setSkip(0); }}
                            className="styled-select"
                        >
                            <option value="all">Todos los Estados</option>
                            <option value="migrated">Migrados</option>
                            <option value="pending">Pendientes</option>
                        </select>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <div className="spinner-mini"></div> : <Search size={18} />}
                            {loading ? 'Procesando...' : 'Actualizar'}
                        </button>
                    </form>

                    <button 
                        className="btn-secondary" 
                        onClick={openManual}
                        title="Ver Manual de Lógica de Composición de Deuda"
                        style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)' }}
                    >
                        <HelpCircle size={18} />
                        Manual de Lógica
                    </button>

                    <button 
                        className="btn-secondary" 
                        onClick={handleOpenCopyModal} 
                        disabled={copyLoading}
                        title="Copiar lista de IDs pendientes"
                    >
                        {copyLoading ? <div className="spinner-mini"></div> : <FileText size={18} />}
                        Exportar IDs
                    </button>
                </div>
            </div>

            {loading && (
                <div className="processing-overlay">
                    <div className="processing-content">
                        <div className="spinner-large"></div>
                        <p>Analizando bases de datos...</p>
                        <small>Comparando 200,000+ registros</small>
                    </div>
                </div>
            )}

            {/* QUICK STATS DASHBOARD */}
            <div className="stats-dashboard">
                <div className="stat-card main">
                    <div className="stat-icon legacy"><Database size={24} /></div>
                    <div className="stat-content">
                        <label>Total MariaDB</label>
                        <div className="stat-value">{statsLoading ? '...' : stats?.mariaTotal?.toLocaleString()}</div>
                    </div>
                </div>
                <div className="stat-card main">
                    <div className="stat-icon new"><Database size={24} /></div>
                    <div className="stat-content">
                        <label>Total Postgres</label>
                        <div className="stat-value">{statsLoading ? '...' : stats?.pgTotal?.toLocaleString()}</div>
                    </div>
                </div>
                <div className="stat-card highlight">
                    <div className={`stat-content ${stats?.pendingCount > 0 ? 'warning' : 'success'}`}>
                        <label>Pendientes de Migrar</label>
                        <div className="stat-value">{statsLoading ? '...' : stats?.pendingCount?.toLocaleString()}</div>
                    </div>
                    <div className="stat-progress">
                        <div className="progress-bar" style={{ 
                            width: `${stats ? (stats.migratedCount / stats.mariaTotal * 100) : 0}%`,
                            background: '#10b981'
                        }}></div>
                    </div>
                    <div style={{ fontSize: '0.7rem', marginTop: '5px', textAlign: 'right' }}>
                        {stats ? Math.round(stats.migratedCount / stats.mariaTotal * 100) : 0}% Completado
                    </div>
                </div>
                <div className="stat-card list">
                    <label>Apremios por Estado (MariaDB)</label>
                    <div className="stats-mini-list">
                        {stats?.byEstado?.slice(0, 4).map(est => (
                            <div key={est.id} className="mini-list-item">
                                <span className="item-name">{est.name}</span>
                                <span className="item-value">{est.count.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="content-card">
                {error && (
                    <div className="error-banner">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="table-stats">
                    Mostrando {data.length} de {total} apremios encontrados en MariaDB.
                </div>

                <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th colSpan="5" className="system-header legacy">SISTEMA ORIGINAL (MARIADB)</th>
                                <th className="divider"></th>
                                <th colSpan="3" className="system-header new">SISTEMA NUEVO (POSTGRESQL)</th>
                                <th className="divider"></th>
                                <th>ESTADO</th>
                            </tr>
                            <tr>
                                <th>Nro / Titular</th>
                                <th>Cuenta / Ofic</th>
                                <th>Reca / Inju</th>
                                <th>Estado</th>
                                <th>Total</th>
                                <th className="divider"></th>
                                <th>Cédula Nro</th>
                                <th>F. Alta</th>
                                <th>Importe</th>
                                <th className="divider"></th>
                                <th>Migrado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="12" style={{ textAlign: 'center', padding: '3rem' }}>
                                        <div className="spinner"></div>
                                        Cargando comparativa...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan="12" style={{ textAlign: 'center', padding: '3rem' }}>
                                        No se encontraron apremios con los filtros seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, idx) => (
                                    <tr key={idx} className={item.isMigrated ? 'row-migrated' : 'row-pending'}>
                                        <td style={{ minWidth: '180px' }}>
                                            <div style={{ fontWeight: 'bold' }}>{item.legacy.numeapre}</div>
                                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.legacy.tituapre}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 500 }}>
                                                    {item.postgres?.pernom || 'Sin vinculación'}
                                                </div>
                                                {item.postgres?.cedpercod && (
                                                    <button 
                                                        className="btn-icon" 
                                                        onClick={() => handleOpenCtaCte(item.postgres.cedpercod, item.postgres.pernom)}
                                                        title="Ver Cuenta Corriente"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
                                                Cta: {item.legacy.cuenctct} 
                                                {item.postgres?.cedpercod && ` • Percod: ${item.postgres.cedpercod}`}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                                Emisión: {item.legacy.feemapre ? new Date(item.legacy.feemapre).toLocaleDateString() : '-'}
                                            </div>
                                        </td>
                                        <td>
                                            <div>{item.legacy.cuenctct}</div>
                                            <small style={{ opacity: 0.6 }}>Ofic: {item.legacy.codiofic}</small>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.86rem' }}>Rem: {item.legacy.codireca}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                                                Rec: {item.legacy.recaudadordeta || 'N/A'}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: item.legacy.codiinju > 0 ? 500 : 'normal' }}>
                                                Inst: {item.legacy.instanciadeta || item.legacy.codiinju}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{item.legacy.estadodeta || item.legacy.estaapre}</div>
                                            <small style={{ opacity: 0.6 }}>Cod: {item.legacy.estaapre}</small>
                                        </td>
                                        <td className="amount">${parseFloat(item.legacy.totaapre || 0).toFixed(2)}</td>
                                        
                                        <td className="divider"><ArrowRight size={14} opacity={0.3} /></td>
                                        
                                        {item.postgres ? (
                                            <>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <div style={{ fontWeight: 500 }}>{item.postgres.cednro}</div>
                                                        <button 
                                                            className="gr-table-action-btn"
                                                            onClick={() => setSelectedGrNumeApre(item.legacy.numeapre)}
                                                            title="Ver Cédula GR (Rentas) de Postgres"
                                                            style={{
                                                                background: 'rgba(124, 77, 255, 0.15)',
                                                                border: '1px solid rgba(124, 77, 255, 0.3)',
                                                                color: '#cbd5e1',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.target.style.background = '#7c4dff';
                                                                e.target.style.color = '#fff';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.target.style.background = 'rgba(124, 77, 255, 0.15)';
                                                                e.target.style.color = '#cbd5e1';
                                                            }}
                                                        >
                                                            <Scale size={11} /> GR
                                                        </button>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#2563eb', marginBottom: '4px' }}>{item.postgres.cedtexto}</div>
                                                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', flexWrap: 'wrap', marginBottom: '4px' }}>
                                                        <span title="Estado">Est: <strong>{item.postgres.cedestado}</strong></span>
                                                        <span title="Etapa Cobertura">Etp: <strong>{item.postgres.cedetapa}</strong></span>
                                                        {item.postgres.ultima_instancia && (
                                                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                                                • {item.postgres.ultima_instancia.trim()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.postgres.recaudador_nome && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                                            Rec: <strong>{item.postgres.recaudador_nome.trim()}</strong>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>{item.postgres.cedfchalt ? new Date(item.postgres.cedfchalt).toLocaleDateString() : '-'}</td>
                                                <td className="amount">
                                                    <span style={{ 
                                                        color: Math.abs(parseFloat(item.legacy.totaapre || 0) - parseFloat(item.postgres.cedimptot || 0)) > 0.1 ? '#ef4444' : 'inherit',
                                                        fontWeight: Math.abs(parseFloat(item.legacy.totaapre || 0) - parseFloat(item.postgres.cedimptot || 0)) > 0.1 ? 'bold' : 'normal'
                                                    }}>
                                                        ${parseFloat(item.postgres.cedimptot || 0).toFixed(2)}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                No encontrado en Postgres (cedid = {item.legacy.numeapre})
                                            </td>
                                        )}

                                        <td className="divider"></td>
                                        
                                        <td style={{ textAlign: 'center' }}>
                                            {item.isMigrated ? (
                                                <div className="status-pill P" title="Cédula encontrada en Postgres">
                                                    <CheckCircle2 size={14} /> Migrado
                                                </div>
                                            ) : (
                                                <div className="status-pill D" title="Falta en Postgres">
                                                    <AlertCircle size={14} /> Pendiente
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <button 
                        disabled={skip === 0 || loading} 
                        onClick={() => setSkip(Math.max(0, skip - limit))}
                        className="btn-secondary"
                    >
                        Anterior
                    </button>
                    <span>Página {Math.floor(skip / limit) + 1} de {Math.ceil(total / limit) || 1}</span>
                    <button 
                        disabled={skip + limit >= total || loading} 
                        onClick={() => setSkip(skip + limit)}
                        className="btn-secondary"
                    >
                        Siguiente
                    </button>
                </div>
            </div>

            {/* MODAL PARA COPIAR PENDIENTES */}
            {showCopyModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>IDs Pendientes (MariaDB)</h3>
                            <button className="close-btn" onClick={() => setShowCopyModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
                                Lista separada por comas de todos los <code>NumeApre</code> que aún no figuran en la tabla <code>cedula</code> de Postgres.
                            </p>
                            
                            {copyLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>Generando lista...</div>
                            ) : (
                                <>
                                    <textarea 
                                        className="copy-area" 
                                        readOnly 
                                        value={pendingIds.join(',')}
                                        onClick={(e) => e.target.select()}
                                    />
                                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem' }}>Total: <strong>{pendingIds.length}</strong> IDs</span>
                                        <button className="btn-primary" onClick={handleCopyToClipboard}>
                                            <FileText size={16} /> Copiar al Portapapeles
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CUENTA CORRIENTE MODAL */}
            {showCtaCteModal && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg">
                        <div className="modal-header">
                            <div>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CreditCard size={20} color="#2563eb" />
                                    Cuenta Corriente: {ctaCtePerson?.name}
                                </h3>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '4px 0 0 28px' }}>Percod: {ctaCtePerson?.percod}</p>
                            </div>
                            <button className="btn-icon" onClick={() => setShowCtaCteModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ maxHeight: 'calc(90vh - 100px)', overflowY: 'auto' }}>
                            {/* OFFICE TABS */}
                            <div className="office-tabs">
                                {ctaCteOffices.map(office => (
                                    <button 
                                        key={office.id}
                                        className={`office-tab ${activeCtaCteOffice?.id === office.id ? 'active' : ''}`}
                                        onClick={() => setActiveCtaCteOffice(office)}
                                    >
                                        {office.name}
                                    </button>
                                ))}
                                {ctaCteOffices.length === 0 && !ctaCteLoading && (
                                    <div style={{ padding: '1rem', color: 'var(--text-dim)' }}>
                                        No se encontraron oficinas para este contribuyente.
                                    </div>
                                )}
                            </div>

                            {/* DEBT/MOVEMENTS TOGGLE */}
                            <div className="toggle-container" style={{ marginBottom: '1.5rem' }}>
                                <button 
                                    className={`toggle-btn ${ctaCteTab === 'debt' ? 'active' : ''}`}
                                    onClick={() => setCtaCteTab('debt')}
                                >
                                    Deuda Pendiente
                                </button>
                                <button 
                                    className={`toggle-btn ${ctaCteTab === 'movements' ? 'active' : ''}`}
                                    onClick={() => setCtaCteTab('movements')}
                                >
                                    Todos los Movimientos
                                </button>
                            </div>

                            {ctaCteLoading ? (
                                <div style={{ textAlign: 'center', padding: '4rem' }}>
                                    <div className="spinner-large"></div>
                                    <p style={{ marginTop: '1rem', color: 'var(--text-dim)' }}>Cargando datos de cuenta...</p>
                                </div>
                            ) : (
                                <div className="cta-cte-grid">
                                    <div className="cta-cte-side">
                                        <div className="side-header legacy">MariaDB (Legacy)</div>
                                        <div className="table-container-mini">
                                            <table className="mini-table">
                                                <thead>
                                                    <tr>
                                                        <th>Periodo</th>
                                                        <th>Boleto</th>
                                                        <th>Concepto</th>
                                                        <th>Debe</th>
                                                        <th>Total</th>
                                                        <th>F. Pago</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ctaCteData.legacy.map((row, i) => (
                                                        <tr key={i}>
                                                            <td>{row.PeriCtct}/{row.BimeCtct}</td>
                                                            <td style={{ opacity: 0.7, fontSize: '0.75rem' }}>#{row.NumeBole}</td>
                                                            <td>{row.DetaCtct || row.CodiConc}</td>
                                                            <td className="amount">${parseFloat(row.DebeCtct || 0).toFixed(2)}</td>
                                                            <td className="amount" style={{ fontWeight: 'bold' }}>
                                                                ${parseFloat(row.TotaCtct || row.DebeCtct || 0).toFixed(2)}
                                                            </td>
                                                            <td style={{ fontSize: '0.75rem', color: row.FechPago ? '#10b981' : '#94a3b8' }}>
                                                                {row.FechPago ? new Date(row.FechPago).toLocaleDateString() : 'Pend.'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {ctaCteData.legacy.length === 0 && (
                                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>Sin registros</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="cta-cte-side">
                                        <div className="side-header postgres">PostgreSQL</div>
                                        <div className="table-container-mini">
                                            <table className="mini-table">
                                                <thead>
                                                    <tr>
                                                        <th>Periodo</th>
                                                        <th>Concepto</th>
                                                        <th>Debe</th>
                                                        <th>Surg.</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ctaCteData.postgres.map((row, i) => (
                                                        <tr key={i}>
                                                            <td>{row.peri_dsc || `${row.peri_cod}/${row.subperi_cod}`}</td>
                                                            <td>{row.tpotribnom}</td>
                                                            <td className="amount">${parseFloat(row.mov_imp_o || 0).toFixed(2)}</td>
                                                            <td className="amount">${parseFloat(row.rec_imp || 0).toFixed(2)}</td>
                                                            <td className="amount" style={{ fontWeight: 'bold' }}>
                                                                ${(parseFloat(row.mov_imp_o || 0) + parseFloat(row.rec_imp || 0)).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {ctaCteData.postgres.length === 0 && (
                                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>Sin registros</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {selectedGrNumeApre && (
                <PostgresCedulaModal 
                    numeApre={selectedGrNumeApre} 
                    onClose={() => setSelectedGrNumeApre(null)} 
                />
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                /* ... previous styles ... */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: #0f172a;
                    border: 1px solid var(--glass-border);
                    border-radius: 1rem;
                    width: 90%;
                    max-width: 600px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
                }
                .modal-header {
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--glass-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-body {
                    padding: 1.25rem;
                }
                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-dim);
                    cursor: pointer;
                }
                .copy-area {
                    width: 100%;
                    height: 200px;
                    background: #1e293b;
                    border: 1px solid var(--glass-border);
                    border-radius: 0.5rem;
                    color: #e2e8f0;
                    font-family: monospace;
                    font-size: 0.8rem;
                    padding: 1rem;
                    resize: none;
                    outline: none;
                }
                /* Fin modal */
                
                .stats-dashboard {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .stat-card {
                    background: var(--glass);
                    border: 1px solid var(--glass-border);
                    border-radius: 0.75rem;
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .stat-card.main {
                    flex-direction: row;
                    align-items: center;
                    gap: 1rem;
                }
                .stat-icon {
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .stat-icon.legacy { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .stat-icon.new { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
                
                .stat-content label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-dim);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.25rem;
                }
                .stat-value {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: var(--text);
                }
                .stat-content.warning .stat-value { color: #f59e0b; }
                .stat-content.success .stat-value { color: #10b981; }

                .stat-progress {
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    margin-top: 0.75rem;
                    overflow: hidden;
                }
                .progress-bar {
                    height: 100%;
                    transition: width 1s ease-out;
                }

                .stat-card.list label {
                    font-size: 0.75rem;
                    color: var(--text-dim);
                    margin-bottom: 0.75rem;
                    display: block;
                }
                .stats-mini-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }
                .mini-list-item {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.8rem;
                    padding-bottom: 0.25rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .mini-list-item:last-child { border-bottom: none; }
                .item-name { color: var(--text-dim); }
                .item-value { font-weight: 600; }

                .comparison-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                }
                .comparison-table th, .comparison-table td {
                    padding: 0.75rem;
                    text-align: left;
                    border-bottom: 1px solid var(--border);
                }
                .system-header {
                    text-align: center !important;
                    font-weight: bold;
                    letter-spacing: 0.05em;
                    padding: 0.5rem !important;
                }
                .system-header.legacy {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                }
                .system-header.new {
                    background: rgba(37, 99, 235, 0.1);
                    color: #2563eb;
                }
                .divider {
                    width: 20px;
                    padding: 0 !important;
                    border-bottom: none !important;
                    text-align: center !important;
                }
                .row-migrated {
                    background: rgba(16, 185, 129, 0.02);
                }
                .row-pending {
                    background: rgba(239, 68, 68, 0.02);
                }
                .amount {
                    font-family: monospace;
                    font-weight: 500;
                }
                .table-stats {
                    margin-bottom: 1rem;
                    font-size: 0.85rem;
                    color: var(--text-dim);
                }
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 1.5rem;
                    margin-top: 1.5rem;
                }
                .office-select, .styled-select {
                    background: #1e293b;
                    border: 1px solid var(--glass-border);
                    color: white;
                    padding: 0.45rem 0.8rem;
                    border-radius: 0.5rem;
                    outline: none;
                    cursor: pointer;
                    min-width: 150px;
                    font-size: 0.85rem;
                }
                .styled-select option {
                    background: #1e293b;
                    color: white;
                    padding: 10px;
                }
                .styled-select:focus {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
                }

                /* Loading States */
                .processing-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }
                .processing-content {
                    background: var(--glass);
                    border: 1px solid var(--glass-border);
                    padding: 2.5rem 4rem;
                    border-radius: 1.5rem;
                    text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .processing-content p {
                    margin-top: 1.5rem;
                    font-size: 1.1rem;
                    font-weight: 500;
                    color: white;
                }
                .processing-content small {
                    display: block;
                    margin-top: 0.5rem;
                    color: var(--text-dim);
                    letter-spacing: 0.05em;
                }

                .spinner-mini {
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                .spinner-large {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(37, 99, 235, 0.1);
                    border-top-color: #2563eb;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Cta-Cte Modal Specifics */
                .modal-lg {
                    max-width: 1200px;
                    width: 95%;
                }

                .office-tabs {
                    display: flex;
                    gap: 8px;
                    padding: 4px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    overflow-x: auto;
                }
                .office-tab {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: var(--text-dim);
                    cursor: pointer;
                    white-space: nowrap;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .office-tab.active {
                    background: white;
                    color: #2563eb;
                    font-weight: 600;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }

                .cta-cte-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    height: 500px;
                }
                .cta-cte-side {
                    display: flex;
                    flex-direction: column;
                    background: rgba(255,255,255,0.03);
                    border-radius: 12px;
                    border: 1px solid var(--glass-border);
                    overflow: hidden;
                }
                .side-header {
                    padding: 8px 16px;
                    font-size: 0.75rem;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: white;
                }
                .side-header.legacy { background: #991b1b; }
                .side-header.postgres { background: #1e40af; }

                .table-container-mini {
                    flex: 1;
                    overflow-y: auto;
                    padding: 4px;
                }
                .mini-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                }
                .mini-table th {
                    text-align: left;
                    padding: 8px;
                    border-bottom: 1px solid var(--glass-border);
                    color: var(--text-dim);
                    font-weight: 500;
                }
                .mini-table td {
                    padding: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.02);
                }

                .toggle-container {
                    display: flex;
                    gap: 4px;
                    background: rgba(0,0,0,0.1);
                    padding: 4px;
                    border-radius: 8px;
                    width: fit-content;
                }
                .toggle-btn {
                    padding: 6px 16px;
                    font-size: 0.8rem;
                    border-radius: 6px;
                    border: none;
                    background: transparent;
                    color: var(--text-dim);
                    cursor: pointer;
                }
                .toggle-btn.active {
                    background: #2563eb;
                    color: white;
                }

                .btn-icon {
                    background: rgba(37, 99, 235, 0.1);
                    border: 1px solid rgba(37, 99, 235, 0.2);
                    color: #2563eb;
                    padding: 6px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-icon:hover {
                    background: #2563eb;
                    color: white;
                    transform: translateY(-1px);
                }
            `}} />
            {/* Modal Manual de Lógica */}
            {showManualModal && (
                <div className="cta-cte-modal-overlay">
                    <div className="cta-cte-modal-content" style={{ width: '80%', maxWidth: '800px', maxHeight: '80vh' }}>
                        <div className="cta-cte-modal-header">
                            <h3>Manual de Lógica de Composición de Deuda</h3>
                            <button onClick={() => setShowManualModal(false)} className="cta-cte-modal-close">&times;</button>
                        </div>
                        <div className="cta-cte-modal-body" style={{ background: '#1a1d21', color: '#e0e0e0', padding: '30px', overflowY: 'auto' }}>
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.6' }}>
                                {manualContent}
                            </pre>
                        </div>
                        <div className="cta-cte-modal-footer">
                            <button onClick={() => setShowManualModal(false)} className="btn-secondary">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Apremios;
