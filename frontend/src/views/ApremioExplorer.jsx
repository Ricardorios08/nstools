import React, { useState } from 'react';
import axios from 'axios';
import { Search, FileText, Calendar, User, Hash, Filter, ChevronLeft, ChevronRight, Scale, Gavel, Briefcase } from 'lucide-react';
import { API_URL } from '../config';
import PostgresCedulaModal from '../components/PostgresCedulaModal';

const ApremioExplorer = () => {
    const [selectedGrNumeApre, setSelectedGrNumeApre] = useState(null);
    const [filters, setFilters] = useState({
        numeApre: '',
        title: '',
        account: '',
        personId: '',
        officeId: '',
        status: '',
        recaId: '',
        autoApre: '',
        dateFrom: '',
        dateTo: ''
    });
    const [results, setResults] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (e, pageNum = 1) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const params = { ...filters, page: pageNum, limit: 50 };
            Object.keys(params).forEach(key => (params[key] === '' || params[key] == null) && delete params[key]);

            const res = await axios.get(`${API_URL}/apremios/explorer`, { params });
            setResults(res.data.results);
            setPagination(res.data.pagination);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
    };

    const getStatusColor = (status) => {
        if (status === 11) return '#10b981'; // Terminado/Cancelado
        if (status === 0) return '#ef4444';  // Baja/Anulado? Depende del sistema
        return '#3b82f6';
    };

    return (
        <div className="body-content">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Scale size={32} color="var(--primary)" />
                    Explorador de Tabla Apremios
                </h1>
                <p style={{ color: 'var(--text-dim)' }}>Consulta técnica sobre la tabla recaudacion2.apremio y sus estados.</p>
            </div>

            {/* Filters Form */}
            <div className="data-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label className="filter-label"><Hash size={14} /> Nro Apremio</label>
                        <input type="number" className="input-field" value={filters.numeApre} onChange={(e) => setFilters({...filters, numeApre: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><User size={14} /> Título / Carátula</label>
                        <input type="text" className="input-field" value={filters.title} onChange={(e) => setFilters({...filters, title: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><FileText size={14} /> Padrón / Cuenta</label>
                        <input type="text" className="input-field" value={filters.account} onChange={(e) => setFilters({...filters, account: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Hash size={14} /> Oficina</label>
                        <input type="number" className="input-field" value={filters.officeId} onChange={(e) => setFilters({...filters, officeId: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Filter size={14} /> Estado</label>
                        <select className="input-field" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
                            <option value="">Todos</option>
                            <option value="1">Iniciado</option>
                            <option value="5">En Procuración</option>
                            <option value="10">Judicial</option>
                            <option value="11">Terminado</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Gavel size={14} /> Autos</label>
                        <input type="number" className="input-field" value={filters.autoApre} onChange={(e) => setFilters({...filters, autoApre: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Briefcase size={14} /> Recaudador</label>
                        <input type="number" className="input-field" value={filters.recaId} onChange={(e) => setFilters({...filters, recaId: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Calendar size={14} /> Desde (Alta)</label>
                        <input type="date" className="input-field" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Calendar size={14} /> Hasta (Alta)</label>
                        <input type="date" className="input-field" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '42px' }} disabled={loading}>
                            <Search size={18} /> {loading ? 'Buscando...' : 'Filtrar Apremios'}
                        </button>
                    </div>
                </form>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Results Table */}
            <div className="data-card" style={{ overflowX: 'auto' }}>
                <table className="user-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                        <tr>
                            <th>Nro Apremio</th>
                            <th>Carátula / Título</th>
                            <th>Padrón</th>
                            <th>Ofic</th>
                            <th>Estado</th>
                            <th>Fecha Alta</th>
                            <th style={{ textAlign: 'right' }}>Capital</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                            <th>Autos</th>
                            <th>Recaudador</th>
                            <th>Usuario</th>
                            <th>GR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.length === 0 && !loading ? (
                            <tr><td colSpan="12" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Sin resultados</td></tr>
                        ) : results.map((a, i) => (
                            <tr key={i} className="table-row">
                                <td style={{ fontWeight: '700' }}>#{a.NumeApre}</td>
                                <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.TituApre}>
                                    {a.TituApre}
                                </td>
                                <td style={{ color: 'var(--primary)', fontWeight: '600' }}>{a.CuenCtct}</td>
                                <td>{a.CodiOfic}</td>
                                <td>
                                    <span style={{ 
                                        padding: '0.2rem 0.5rem', 
                                        borderRadius: '4px', 
                                        fontSize: '0.7rem', 
                                        fontWeight: '700',
                                        background: `${getStatusColor(a.EstaApre)}20`,
                                        color: getStatusColor(a.EstaApre)
                                    }}>{a.EstadoDeta || `Est ${a.EstaApre}`}</span>
                                </td>
                                <td>{a.FealApre ? new Date(a.FealApre).toLocaleDateString() : 'N/A'}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(a.CapiApre)}</td>
                                <td style={{ textAlign: 'right', fontWeight: '700' }}>{formatCurrency(a.TotaApre)}</td>
                                <td>{a.AutoApre}</td>
                                <td style={{ fontSize: '0.75rem' }}>{a.RecaudadorDeta || `Cód ${a.CodiReca}`}</td>
                                <td>{a.AltaUsua}</td>
                                <td>
                                    <button 
                                        onClick={() => setSelectedGrNumeApre(a.NumeApre)}
                                        title="Ver Cédula GR (Rentas) de Postgres"
                                        style={{
                                            background: 'rgba(124, 77, 255, 0.15)',
                                            border: '1px solid rgba(124, 77, 255, 0.3)',
                                            color: '#a78bfa',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#7c4dff';
                                            e.currentTarget.style.color = '#fff';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(124, 77, 255, 0.15)';
                                            e.currentTarget.style.color = '#a78bfa';
                                        }}
                                    >
                                        <Scale size={12} /> GR
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="pagination-container" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
                    <button disabled={pagination.page === 1} onClick={() => handleSearch(null, pagination.page - 1)} className="btn btn-secondary">
                        <ChevronLeft size={18} /> Anterior
                    </button>
                    <span>Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)</span>
                    <button disabled={pagination.page === pagination.totalPages} onClick={() => handleSearch(null, pagination.page + 1)} className="btn btn-secondary">
                        Siguiente <ChevronRight size={18} />
                    </button>
                </div>
            )}

            <style>{`
                .filter-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--text-dim);
                    margin-bottom: 0.5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .error-message {
                    padding: 1rem;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                }
            `}</style>

            {selectedGrNumeApre && (
                <PostgresCedulaModal 
                    numeApre={selectedGrNumeApre} 
                    onClose={() => setSelectedGrNumeApre(null)} 
                />
            )}
        </div>
    );
};

export default ApremioExplorer;
