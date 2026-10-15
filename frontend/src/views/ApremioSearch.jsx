import React, { useState } from 'react';
import axios from 'axios';
import { Search, ShieldCheck, ShieldAlert, Database, ArrowRight, Info, Scale, CheckCircle2, AlertCircle, User, FileText, ChevronRight } from 'lucide-react';
import { API_URL } from '../config';
import PostgresCedulaModal from '../components/PostgresCedulaModal';

const ApremioSearch = () => {
    const [selectedGrNumeApre, setSelectedGrNumeApre] = useState(null);
    const [numeapre, setNumeapre] = useState('');
    const [cuenctct, setCuenctct] = useState('');
    const [codiof, setCodiof] = useState('');
    const [estado, setEstado] = useState('');
    const [tituapre, setTituapre] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [queries, setQueries] = useState(null);
    const [error, setError] = useState(null);

    const handleSearchCombined = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        setSelectedItem(null);
        setQueries(null);

        try {
            const params = new URLSearchParams();
            if (numeapre.trim()) params.append('numeapre', numeapre.trim());
            if (cuenctct.trim()) params.append('cuenctct', cuenctct.trim());
            if (codiof.trim()) params.append('codiof', codiof.trim());
            if (estado.trim()) params.append('estado', estado.trim());
            if (tituapre.trim()) params.append('tituapre', tituapre.trim());

            const res = await axios.get(`${API_URL}/apremios/search-combined?${params.toString()}`);
            setResults(res.data.results);
            setQueries(res.data.queries);

            if (res.data.results.length === 0) {
                setError('No se encontraron apremios que coincidan con los filtros seleccionados.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error al buscar apremios.');
        } finally {
            setLoading(false);
        }
    };

    const StatusIcon = ({ status }) => {
        if (!status.inMaria) return <Database size={16} color="#94a3b8" title="No en MariaDB" />;
        if (!status.inPostgres) return <AlertCircle size={16} color="#ef4444" title="No migrado a Postgres" />;
        if (status.match) return <ShieldCheck size={16} color="#10b981" title="Saldos coinciden" />;
        return <ShieldAlert size={16} color="#f59e0b" title="Diferencia de saldos" />;
    };

    const inputStyle = {
        width: '100%',
        padding: '0.7rem 0.8rem',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: '0.9rem',
        outline: 'none',
        transition: 'all 0.2s',
        boxSizing: 'border-box'
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Scale color="#7c4dff" />
                    Buscador de Paridad de Apremios
                </h1>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    Búsqueda combinada en tiempo real. Escriba en los campos y presione Aplicar para buscar cruzando índices.
                </p>
            </div>

            {/* Inline Combinable Filters Grid */}
            <div style={{
                background: 'var(--card)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                marginBottom: '2rem'
            }}>
                <form onSubmit={handleSearchCombined}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1.25rem',
                        alignItems: 'end'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', paddingLeft: '4px' }}>ID APREMIO</span>
                            <input
                                type="text"
                                placeholder="Ej: 12165108"
                                value={numeapre}
                                onChange={(e) => setNumeapre(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', paddingLeft: '4px' }}>CUENTA (CUENCTCT)</span>
                            <input
                                type="text"
                                placeholder="Ej: 44656"
                                value={cuenctct}
                                onChange={(e) => setCuenctct(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', paddingLeft: '4px' }}>OFICINA (CODIOF)</span>
                            <input
                                type="text"
                                placeholder="Ej: 1"
                                value={codiof}
                                onChange={(e) => setCodiof(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', paddingLeft: '4px' }}>ESTADO</span>
                            <input
                                type="text"
                                placeholder="Ej: Cancelado o D"
                                value={estado}
                                onChange={(e) => setEstado(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', paddingLeft: '4px' }}>CONTRIBUYENTE / TITULAR</span>
                            <input
                                type="text"
                                placeholder="Ej: DIAZ EMIGDIO"
                                value={tituapre}
                                onChange={(e) => setTituapre(e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    flex: 2,
                                    padding: '0.8rem',
                                    borderRadius: '10px',
                                    background: '#7c4dff',
                                    color: '#fff',
                                    border: 'none',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(124, 77, 255, 0.2)'
                                }}
                            >
                                {loading ? 'Buscando...' : 'Aplicar'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setNumeapre('');
                                    setCuenctct('');
                                    setCodiof('');
                                    setEstado('');
                                    setTituapre('');
                                    setResults([]);
                                    setQueries(null);
                                    setSelectedItem(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '0.8rem',
                                    borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.03)',
                                    color: 'var(--text-dim)',
                                    border: '1px solid var(--border)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: results.length > 0 ? '400px 1fr' : '1fr', gap: '2rem' }}>
                
                {/* Results List */}
                {results.length > 0 && (
                    <div style={{
                        background: 'var(--card)',
                        borderRadius: '16px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                        height: 'fit-content'
                    }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem', background: '#f8fafc' }}>
                            RESULTADOS ({results.length})
                        </div>
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {results.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    style={{
                                        padding: '1rem',
                                        borderBottom: '1px solid var(--border)',
                                        cursor: 'pointer',
                                        background: selectedItem?.id === item.id ? '#f0f4ff' : 'transparent',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: selectedItem?.id === item.id ? '#7c4dff' : 'var(--text)' }}>
                                            ID: {item.id}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <User size={12} /> {item.postgres?.pernom || item.legacy?.denominacion || item.legacy?.tituapre || 'Contribuyente N/A'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {item.status.inMaria && <span style={{ padding: '2px 4px', borderRadius: '4px', background: '#e11d4822', color: '#e11d48', fontSize: '10px', fontWeight: 800 }}>MDB</span>}
                                            {item.status.inPostgres && <span style={{ padding: '2px 4px', borderRadius: '4px', background: '#3b82f622', color: '#3b82f6', fontSize: '10px', fontWeight: 800 }}>PG</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <StatusIcon status={item.status} />
                                            <ChevronRight size={18} color="var(--text-dim)" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Detail View */}
                <div style={{ minHeight: '400px' }}>
                    {selectedItem ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {/* MariaDB Card */}
                            <DetailCard 
                                title="MARIADB (Legacy)" 
                                icon={<Database size={18} color="#e11d48" />}
                                exists={selectedItem.status.inMaria}
                                data={selectedItem.legacy ? [
                                    { label: 'Nro Apremio', value: selectedItem.legacy.numeapre },
                                    { label: 'Cuenta', value: selectedItem.legacy.cuenctct },
                                    { label: 'Estado', value: selectedItem.legacy.estadodeta },
                                    { label: 'Total', value: `$${parseFloat(selectedItem.legacy.totaapre || 0).toLocaleString()}`, highlight: true, color: '#e11d48' },
                                    { label: 'CuenCtct', value: selectedItem.legacy.cuenctct },
                                    { label: 'CodiOfic (codiof)', value: selectedItem.legacy.codiofic }
                                ] : null}
                            />

                            {/* Postgres Card */}
                            <DetailCard 
                                title="POSTGRESQL (Migrado)" 
                                icon={<Database size={18} color="#3b82f6" />}
                                exists={selectedItem.status.inPostgres}
                                data={selectedItem.postgres ? [
                                    { label: 'ID Cedula', value: selectedItem.postgres.cedid },
                                    { label: 'Nro Cédula', value: selectedItem.postgres.cednro },
                                    { label: 'Estado', value: selectedItem.postgres.cedestado },
                                    { label: 'Monto PG', value: `$${parseFloat(selectedItem.postgres.cedimptot || 0).toLocaleString()}`, highlight: true, color: '#3b82f6' },
                                    { label: 'Percod', value: selectedItem.postgres.cedpercod },
                                    { label: 'CodiFic (seccod)', value: selectedItem.postgres.cedseccod }
                                ] : null}
                            >
                                {selectedItem.status.inPostgres && (
                                    <button
                                        onClick={() => setSelectedGrNumeApre(selectedItem.id)}
                                        style={{
                                            marginTop: '1.25rem',
                                            width: '100%',
                                            padding: '0.65rem',
                                            background: 'rgba(124, 77, 255, 0.15)',
                                            border: '1px solid rgba(124, 77, 255, 0.3)',
                                            borderRadius: '8px',
                                            color: '#7c4dff',
                                            fontWeight: '700',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#7c4dff';
                                            e.currentTarget.style.color = '#fff';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(124, 77, 255, 0.15)';
                                            e.currentTarget.style.color = '#7c4dff';
                                        }}
                                    >
                                        <Scale size={14} /> Ver Estructura GR
                                    </button>
                                )}
                            </DetailCard>

                            {/* Parity Summary */}
                            <div style={{ 
                                gridColumn: 'span 2', 
                                padding: '1.5rem', 
                                background: selectedItem.status.match ? '#f0fdf4' : '#fff7ed', 
                                borderRadius: '16px',
                                border: `1px solid ${selectedItem.status.match ? '#bbf7d0' : '#ffedd5'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                {selectedItem.status.match ? (
                                    <ShieldCheck size={32} color="#166534" />
                                ) : (
                                    <ShieldAlert size={32} color="#ea580c" />
                                )}
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: selectedItem.status.match ? '#166534' : '#9a3412' }}>
                                        {selectedItem.status.match ? 'Saldos Sincronizados' : 'Discrepancia Detectada'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: selectedItem.status.match ? '#15803d' : '#c2410c' }}>
                                        {selectedItem.status.match 
                                            ? 'Los montos registrados en ambos sistemas coinciden exactamente.' 
                                            : 'Existe una diferencia entre el total de MariaDB y el monto migrado a Postgres.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ 
                            height: '100%', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: 'var(--card)',
                            borderRadius: '16px',
                            border: '1px dashed var(--border)',
                            color: 'var(--text-dim)'
                        }}>
                            {error ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                    <p>{error}</p>
                                </div>
                            ) : (
                                <>
                                    <Search size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                                    <p>Busque y seleccione un apremio para ver la comparativa</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {selectedGrNumeApre && (
                <PostgresCedulaModal 
                    numeApre={selectedGrNumeApre} 
                    onClose={() => setSelectedGrNumeApre(null)} 
                />
            )}
            
            {/* Live SQL Queries Section */}
            {queries && (
                <div style={{
                    marginTop: '2rem',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                        <Database size={18} color="#7c4dff" />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                            Consultas SQL Ejecutadas en Vivo (Optimizadas con Índices)
                        </h3>
                    </div>
                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.4' }}>
                        Estas son las consultas reales ejecutadas sobre ambos motores. Ambas están diseñadas para forzar la utilización de índices de rango e índices de clave primaria (ej: <code>PRIMARY</code> y <code>CuenCtct</code> en MariaDB, y <code>tcedula_pkey</code> / <code>itcedula3</code> / <code>itcedulacedcuo3</code> en PostgreSQL).
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e11d48', display: 'flex', justifyContent: 'space-between' }}>
                                <span>1. MARIADB QUERY (Legacy)</span>
                                <small style={{ color: 'var(--text-dim)', fontWeight: 500 }}>Index: PRIMARY, CuenCtct, CodiOfic</small>
                            </span>
                            <div style={{ 
                                background: '#0b0f19', 
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px', 
                                padding: '1rem', 
                                overflowX: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                color: '#a5b4fc',
                                maxHeight: '180px'
                            }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{queries.maria}</pre>
                                {queries.mariaParams.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                                        <strong>Parámetros:</strong> {JSON.stringify(queries.mariaParams)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', display: 'flex', justifyContent: 'space-between' }}>
                                <span>2. POSTGRESQL QUERY (Migrado)</span>
                                <small style={{ color: 'var(--text-dim)', fontWeight: 500 }}>Index: tcedula_pkey, itcedula3, itcedulacedcuo3</small>
                            </span>
                            <div style={{ 
                                background: '#0b0f19', 
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px', 
                                padding: '1rem', 
                                overflowX: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                color: '#a5b4fc',
                                maxHeight: '180px'
                            }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{queries.postgres}</pre>
                                {queries.postgresParams.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                                        <strong>Parámetros:</strong> {JSON.stringify(queries.postgresParams)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DetailCard = ({ title, icon, exists, data, children }) => (
    <div style={{
        background: 'var(--card)',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        overflow: 'hidden'
    }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>
                {icon}
                {title}
            </div>
            <div style={{ 
                fontSize: '0.65rem', 
                fontWeight: 800, 
                padding: '2px 8px', 
                borderRadius: '10px', 
                background: exists ? '#dcfce7' : '#fee2e2',
                color: exists ? '#166534' : '#991b1b'
            }}>
                {exists ? 'PRESENTE' : 'AUSENTE'}
            </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
            {data ? (
                <div>
                    {data.map((field, i) => (
                        <div key={i} style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '2px' }}>{field.label}</div>
                            <div style={{ fontSize: field.highlight ? '1.1rem' : '0.95rem', fontWeight: field.highlight ? 700 : 500, color: field.color || 'var(--text)' }}>
                                {field.value || '—'}
                            </div>
                        </div>
                    ))}
                    {children}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', opacity: 0.4 }}>
                    <FileText size={32} style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.8rem' }}>Sin datos disponibles</div>
                </div>
            )}
        </div>
    </div>
);

export default ApremioSearch;
