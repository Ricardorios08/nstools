import React, { useState, useEffect } from 'react';
import { Search, Database, Table as TableIcon, List, ArrowLeft, Loader2, Filter, Download } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

const TableExplorer = () => {
    const [engine, setEngine] = useState('maria');
    const [db, setDb] = useState(import.meta.env.VITE_MARIA_DB_NAME || 'recaudacion2');
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);

    const availableDbs = engine === 'maria' ? [
        { id: 'infogov', name: 'InfoGov', color: '#2563eb' },
        { id: 'contpres', name: 'ContPres', color: '#f59e0b' },
        { id: 'municipiov1', name: 'MunicipioV1', color: '#10b981' },
        { id: 'personal3', name: 'Personal3', color: '#ec4899' },
        { id: 'recahisto', name: 'RecaHisto', color: '#8b5cf6' },
        { id: import.meta.env.VITE_MARIA_DB_NAME || 'recaudacion2', name: 'Recaudación', color: '#6366f1' }
    ] : [
        { id: 'public', name: 'PostgreSQL', color: '#336791' }
    ];

    useEffect(() => {
        fetchTables();
    }, [db, engine]);

    const fetchTables = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/explorer/${engine}/${db}/tables`);
            const result = res.data;
            setTables(Array.isArray(result) ? result.sort((a, b) => (b.rows || 0) - (a.rows || 0)) : []);
        } catch (err) {
            setError(`Error cargando tablas de ${db}: ` + err.message);
        } finally {
            setLoading(false);
        }
    };

    const exploreTable = async (tableName) => {
        setSelectedTable(tableName);
        setLoading(true);
        setData([]);
        setSearchQuery('');
        try {
            const res = await axios.get(`${API_URL}/explorer/${engine}/${db}/explore/${tableName}`);
            const result = res.data;
            if (result.length > 0) {
                setColumns(Object.keys(result[0]));
            }
            setData(result);
        } catch (err) {
            setError(`Error explorando ${db}.${tableName}: ` + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/explorer/${engine}/${db}/explore/${selectedTable}?q=${encodeURIComponent(searchQuery)}`);
            const result = res.data;
            setData(result);
        } catch (err) {
            setError('Error en la búsqueda: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <div className="body-content">
                <div className="welcome-card" style={{ border: '1px solid #ef4444' }}>
                    <h2 style={{ color: '#ef4444' }}>Error</h2>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={() => { setError(null); fetchTables(); }}>Reintentar</button>
                    <button className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => setSelectedTable(null)}>Volver</button>
                </div>
            </div>
        );
    }

    return (
        <div className="body-content" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {!selectedTable ? (
                <div className="welcome-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--border)', padding: '0.25rem', borderRadius: '0.75rem', width: 'fit-content' }}>
                            <button 
                                className={`btn ${engine === 'maria' ? 'btn-primary' : ''}`}
                                style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}
                                onClick={() => { setEngine('maria'); setDb(import.meta.env.VITE_MARIA_DB_NAME || 'recaudacion2'); }}
                            >
                                MariaDB
                            </button>
                            <button 
                                className={`btn ${engine === 'pg' ? 'btn-primary' : ''}`}
                                style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', background: engine === 'pg' ? '#336791' : 'transparent', borderColor: engine === 'pg' ? '#336791' : 'transparent' }}
                                onClick={() => { setEngine('pg'); setDb('public'); }}
                            >
                                PostgreSQL
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--border)', padding: '0.25rem', borderRadius: '0.75rem', overflowX: 'auto', maxWidth: '100%' }}>
                            {availableDbs.map(database => (
                                <button 
                                    key={database.id}
                                    className={`btn ${db === database.id ? 'btn-primary' : ''}`} 
                                    style={{ 
                                        padding: '0.4rem 0.85rem', 
                                        fontSize: '0.8rem',
                                        background: db === database.id ? database.color : 'transparent',
                                        borderColor: db === database.id ? database.color : 'transparent',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onClick={() => { setDb(database.id); setTables([]); }}
                                >
                                    {database.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                        {loading && tables.length === 0 ? (
                            Array(12).fill(0).map((_, i) => (
                                <div key={i} className="data-card" style={{ height: '110px', animation: 'pulse 1.5s infinite', border: 'none' }}></div>
                            ))
                        ) : (
                            tables.map(table => (
                                <div 
                                    key={table.name} 
                                    className="data-card" 
                                    style={{ 
                                        cursor: 'pointer', 
                                        transition: 'all 0.2s',
                                        border: '1px solid var(--glass-border)',
                                        borderLeft: `4px solid ${availableDbs.find(d => d.id === db)?.color}`
                                    }}
                                    onClick={() => exploreTable(table.name)}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <TableIcon size={18} color={availableDbs.find(d => d.id === db)?.color} />
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{table.name}</h3>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Registros:</span>
                                        <span style={{ 
                                            fontSize: '0.8rem', 
                                            fontWeight: 700,
                                            padding: '0.2rem 0.6rem',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '0.5rem'
                                        }}>
                                            {table.rows?.toLocaleString() || 0}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="welcome-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button className="btn" style={{ padding: '0.5rem', background: 'var(--border)' }} onClick={() => setSelectedTable(null)}>
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
                                    <span style={{ color: availableDbs.find(d => d.id === db)?.color, fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>{db}</span>
                                    {selectedTable}
                                </h1>
                                <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '0.85rem' }}>Muestra de los primeros 100 registros encontrados</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '500px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                <input 
                                    type="text" 
                                    className="input-field" 
                                    placeholder={`Buscar en ${selectedTable}...`} 
                                    style={{ paddingLeft: '2.5rem' }}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: availableDbs.find(d => d.id === db)?.color, borderColor: availableDbs.find(d => d.id === db)?.color }}>
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Filter size={18} />}
                                <span style={{ marginLeft: '0.5rem' }}>Filtrar</span>
                            </button>
                        </form>
                    </div>

                    <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 350px)', overflow: 'auto', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <table className="data-table">
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    {columns.map(col => (
                                        <th key={col} style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.length > 0 ? (
                                    data.map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            {columns.map(col => (
                                                <td key={col} style={{ whiteSpace: 'nowrap', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                                                    {String(row[col] === null ? '' : row[col])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={columns.length} style={{ textAlign: 'center', padding: '5rem' }}>
                                            {loading ? <Loader2 className="animate-spin" size={32} color={availableDbs.find(d => d.id === db)?.color} style={{ margin: '0 auto' }} /> : 'No se encontraron registros para mostrar.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableExplorer;
