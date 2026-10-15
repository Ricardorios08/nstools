import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, FileText, Calendar, User, Hash, Filter, ChevronLeft, ChevronRight, Download, Users, Clock } from 'lucide-react';
import { API_URL } from '../config';

const BoletoExplorer = () => {
    const [filters, setFilters] = useState({
        officeId: '',
        account: '',
        personId: '',
        period: '',
        status: '',
        type: '',
        numeBole: '',
        userAlta: '',
        dateFrom: '',
        dateTo: ''
    });
    const [results, setResults] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedBoleto, setSelectedBoleto] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [boletoData, setBoletoData] = useState(null);

    const handleSearch = async (e, pageNum = 1) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const params = { ...filters, page: pageNum, limit: 20 };
            // Clean empty params
            Object.keys(params).forEach(key => (params[key] === '' || params[key] == null) && delete params[key]);

            const res = await axios.get(`${API_URL}/boletos/explorer`, { params });
            setResults(res.data.results);
            setPagination(res.data.pagination);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchFullInfo = async (peri, nume) => {
        setDetailLoading(true);
        try {
            const res = await axios.get(`${API_URL}/boletos/details/${peri}/${nume}`);
            setBoletoData(res.data);
            setSelectedBoleto({ peri, nume });
        } catch (err) {
            alert("Error al cargar detalle: " + err.message);
        } finally {
            setDetailLoading(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
    };

    const formatDate = (date) => date ? new Date(date).toLocaleDateString() : '-';

    return (
        <div className="body-content">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileText size={32} color="var(--primary)" />
                    Explorador de Tabla Boletos
                </h1>
                <p style={{ color: 'var(--text-dim)' }}>Consulta técnica masiva sobre recaudacion2.boleto y trazabilidad legal.</p>
            </div>

            {/* Advanced Filters */}
            <div className="data-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label className="filter-label"><Calendar size={14} /> Año (PeriBole)</label>
                        <input type="number" className="input-field" value={filters.period} onChange={(e) => setFilters({...filters, period: e.target.value})} placeholder="Ej: 2024" />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Hash size={14} /> Número (NumeBole)</label>
                        <input type="number" className="input-field" value={filters.numeBole} onChange={(e) => setFilters({...filters, numeBole: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><FileText size={14} /> Padrón / Cuenta</label>
                        <input type="text" className="input-field" value={filters.account} onChange={(e) => setFilters({...filters, account: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><User size={14} /> CUCU Persona</label>
                        <input type="text" className="input-field" value={filters.personId} onChange={(e) => setFilters({...filters, personId: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Hash size={14} /> Oficina</label>
                        <input type="number" className="input-field" value={filters.officeId} onChange={(e) => setFilters({...filters, officeId: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label className="filter-label"><Filter size={14} /> Estado</label>
                        <input type="text" className="input-field" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})} placeholder="Pagado, Emitido..." />
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
                            <Search size={18} /> {loading ? 'Buscando...' : 'Filtrar Tabla'}
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
                            <th>Periodo</th>
                            <th>Número</th>
                            <th>Cuenta</th>
                            <th>Persona</th>
                            <th>Ofic</th>
                            <th>Estado</th>
                            <th>Tipo</th>
                            <th style={{ textAlign: 'right' }}>Capital</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                            <th>Vencimiento</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.length === 0 && !loading ? (
                            <tr><td colSpan="11" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Sin resultados</td></tr>
                        ) : results.map((b, i) => (
                            <tr key={i} className="table-row">
                                <td style={{ fontWeight: '700' }}>{b.PeriBole}</td>
                                <td>{b.NumeBole}</td>
                                <td style={{ color: 'var(--primary)', fontWeight: '600' }}>{b.CuenCtct}</td>
                                <td style={{ fontSize: '0.75rem' }}>{b.CucuPers}</td>
                                <td>{b.CodiOfic}</td>
                                <td>
                                    <span style={{ 
                                        padding: '0.2rem 0.5rem', 
                                        borderRadius: '4px', 
                                        fontSize: '0.7rem', 
                                        fontWeight: '700',
                                        background: b.EstaBole === 'Pagado' ? '#10b98120' : '#3b82f620',
                                        color: b.EstaBole === 'Pagado' ? '#10b981' : '#3b82f6'
                                    }}>{b.EstaBole}</span>
                                </td>
                                <td>{b.TipoBole}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(b.CapiBole)}</td>
                                <td style={{ textAlign: 'right', fontWeight: '700' }}>{formatCurrency(b.TotaBole)}</td>
                                <td>{b.FeveBole ? new Date(b.FeveBole).toLocaleDateString() : 'N/A'}</td>
                                <td>
                                    <button 
                                        className="btn btn-secondary" 
                                        style={{ padding: '0.25rem 0.5rem' }}
                                        onClick={() => fetchFullInfo(b.PeriBole, b.NumeBole)}
                                        disabled={detailLoading}
                                    >
                                        <Info size={14} />
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

            {/* Detail Modal */}
            {selectedBoleto && boletoData && (
                <div className="modal-overlay" onClick={() => setSelectedBoleto(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%' }}>
                        <div className="modal-header">
                            <h3>Detalle Completo: {selectedBoleto.peri} / {selectedBoleto.nume}</h3>
                            <button className="close-btn" onClick={() => setSelectedBoleto(null)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                <div className="data-card" style={{ padding: '1rem' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>CONTRIBUYENTE</label>
                                    <div style={{ fontWeight: '700' }}>{boletoData.header?.NombreContribuyente || 'N/A'}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>CUCU: {boletoData.header?.CucuPers}</div>
                                </div>
                                <div className="data-card" style={{ padding: '1rem' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>ESTADO</label>
                                    <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{boletoData.header?.EstaBole}</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{boletoData.header?.TipoBole}</div>
                                </div>
                                <div className="data-card" style={{ padding: '1rem' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>RECAUDADOR</label>
                                    <div style={{ fontWeight: '700' }}>{boletoData.header?.Recaudador || 'Sin asignar'}</div>
                                </div>
                            </div>

                            {/* LEGAL PAYMENTS SECTION */}
                            {boletoData.legalPayments && boletoData.legalPayments.length > 0 && (
                                <div className="data-card" style={{ padding: '1.5rem', borderLeft: '5px solid #10b981', background: 'rgba(16, 185, 129, 0.05)', marginBottom: '2rem' }}>
                                    <h4 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <DollarSign size={20} /> PAGOS DE APREMIO (Honorarios / Gastos)
                                    </h4>
                                    <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #10b98140' }}>
                                                <th>Fecha</th>
                                                <th>Cuota</th>
                                                <th>Estado</th>
                                                <th style={{ textAlign: 'right' }}>Honorarios</th>
                                                <th style={{ textAlign: 'right' }}>Gastos</th>
                                                <th style={{ textAlign: 'right' }}>Interés</th>
                                                <th>Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {boletoData.legalPayments.map((lp, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #10b98110' }}>
                                                    <td style={{ padding: '0.5rem 0' }}>{formatDate(lp.FeacPaap)}</td>
                                                    <td>{lp.NumePaag}</td>
                                                    <td>{lp.EstaPaap}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(lp.Honorarios)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(lp.Gastos)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(lp.Interes)}</td>
                                                    <td>{lp.AltaUsua}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* CONCEPTS TABLE */}
                            <div className="data-card" style={{ padding: '0', overflow: 'hidden' }}>
                                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Conceptos del Boleto</h4>
                                </div>
                                <table className="user-table" style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Periodo</th>
                                            <th>Concepto</th>
                                            <th style={{ textAlign: 'right' }}>Capital</th>
                                            <th style={{ textAlign: 'right' }}>Interes</th>
                                            <th style={{ textAlign: 'right' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {boletoData.concepts.map((c, i) => (
                                            <tr key={i}>
                                                <td>{c.PeriCtct}/{c.BimeCtct}</td>
                                                <td>{c.DetaConc}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(c.Capital)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(c.Interes)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: '700' }}>{formatCurrency(c.Total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
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
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: var(--bg-card);
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    animation: fadeIn 0.2s ease-out;
                }
                .modal-header {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .close-btn {
                    background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-dim);
                }
            `}</style>
        </div>
    );
};

export default BoletoExplorer;
