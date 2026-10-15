import React, { useState, useEffect } from 'react';
import { 
    X, FileText, CheckCircle2, AlertCircle, Calendar, 
    DollarSign, Activity, Clock, ArrowRight, Percent, 
    Settings, Shield, User, Scale, MapPin, Hash, Printer,
    Database, Copy, Check
} from 'lucide-react';
import { API_URL } from '../config';

const PostgresCedulaModal = ({ numeApre, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('data'); // 'data' o 'sql'
    const [copiedId, setCopiedId] = useState(null);

    const handleCopySql = (id, sqlText) => {
        navigator.clipboard.writeText(sqlText);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const highlightSQL = (sql) => {
        const keywords = ['SELECT', 'FROM', 'LEFT JOIN', 'WHERE', 'ON', 'ORDER BY', 'ASC', 'DESC', 'CAST', 'AS', 'TEXT', 'IN', 'ANY', 'AND', 'OR', 'TRIM'];
        let highlighted = sql;
        keywords.forEach(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'g');
            highlighted = highlighted.replace(regex, `<span style="color: #c084fc; font-weight: bold;">${kw}</span>`);
        });
        highlighted = highlighted.replace(/\b(public\.\w+)\b/g, '<span style="color: #fb7185;">$1</span>');
        highlighted = highlighted.replace(/(\$\d)/g, '<span style="color: #fbbf24;">$1</span>');
        return highlighted;
    };

    const sqlQueries = [
        {
            id: 'cedula',
            title: '1. Cédula & Contribuyente (cedula + persona)',
            desc: 'Recupera los datos de identificación, importes y el nombre del titular de la cédula cruzando con el padrón único de personas.',
            params: `cedid = '${numeApre}'`,
            sql: `SELECT c.*, TRIM(p.pernom) as pernom \nFROM public.cedula c \nLEFT JOIN public.persona p ON c.cedpercod = p.percod \nWHERE c.cedid = $1 OR CAST(c.cednro AS TEXT) = $1;`
        },
        {
            id: 'instances',
            title: '2. Historial de Instancias (cedinstancia + tipcedinstancia)',
            desc: 'Consulta la cronología completa de instancias y notificaciones generadas para la cédula, resolviendo las descripciones legibles.',
            params: `cednro = ${data?.cedula?.cednro || '—'}`,
            sql: `SELECT ci.*, TRIM(tci.tipcedinsdsc) as tipcedinsdsc, tci.tipcedinstrabar, tci.tipcedinsmedcau \nFROM public.cedinstancia ci \nLEFT JOIN public.tipcedinstancia tci ON ci.tipcedinscod = tci.tipcedinscod \nWHERE ci.cednro = $1 \nORDER BY ci.cedinsfec ASC, ci.cedinscod ASC;`
        },
        {
            id: 'costs',
            title: '3. Coeficientes de Costo (instanciacosto + tipcedinstancia)',
            desc: 'Determina las tasas fijas, porcentajes de recargo, viáticos y topes aplicados para los tipos de instancias de esta cédula en particular.',
            params: `tipcedinscod = ANY(ARRAY[${[...new Set(data?.instances?.map(r => r.tipcedinscod) || [])].join(',') || '—'}]) o IN (${[...new Set(data?.instances?.map(r => r.tipcedinscod) || [])].join(',') || '—'})`,
            sql: `SELECT ic.*, TRIM(tci.tipcedinsdsc) as tipcedinsdsc \nFROM public.instanciacosto ic \nLEFT JOIN public.tipcedinstancia tci ON ic.tipcedinscod = tci.tipcedinscod \nWHERE ic.tipcedinscod = ANY($1)\nORDER BY ic.tipcedinscod ASC, ic.inscosalta DESC;`
        },
        {
            id: 'tipcedula',
            title: '4. Tipo de Cédula (tipcedula)',
            desc: 'Obtiene las propiedades y descripción general correspondientes al tipo específico de la cédula cargada.',
            params: data?.cedula?.cedtpo != null ? `tipcedid = ${data.cedula.cedtpo}` : 'tipcedid = NULL (No definido)',
            sql: `SELECT * FROM public.tipcedula WHERE tipcedid = $1;`
        },
        {
            id: 'cedmotfin',
            title: '5. Motivo de Cierre / Finalización (cedmotfin)',
            desc: 'Recupera el motivo formal del cierre o cancelación de la cédula en caso de haber finalizado su ciclo judicial en Rentas.',
            params: data?.cedula?.cedmotfin != null ? `motfincod = ${data.cedula.cedmotfin}` : 'motfincod = NULL (Cédula activa / Sin motivo de cierre)',
            sql: `SELECT * FROM public.cedmotfin WHERE motfincod = $1;`
        },
        {
            id: 'sector',
            title: '6. Parámetros del Sector (tipocedulasector)',
            desc: 'Obtiene las reglas de plazos y configuraciones geográficas/operativas del sector judicial asociado al tipo de la cédula.',
            params: (data?.cedula?.cedtpo != null && data?.cedula?.cedseccod != null) 
                ? `tipcedid = ${data.cedula.cedtpo}, tipcedseccod = ${data.cedula.cedseccod}` 
                : 'tipcedid = NULL, tipcedseccod = NULL (Sin sector definido)',
            sql: `SELECT * FROM public.tipocedulasector WHERE tipcedid = $1 AND tipcedseccod = $2;`
        },
        {
            id: 'cuotas',
            title: '7. Mapeo de Tributo & Cuotas (tcedulacedcuo)',
            desc: 'Recupera las cuotas y los códigos de tributos/cuentas asociados a la cédula en PostgreSQL.',
            params: data?.cedula?.cednro != null ? `cednro = ${data.cedula.cednro}` : 'cednro = NULL',
            sql: `SELECT * FROM public.tcedulacedcuo WHERE cednro = $1;`
        }
    ];

    useEffect(() => {
        if (!numeApre) return;
        
        const fetchPostgresDetail = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('nomade_token');
                const res = await fetch(`${API_URL}/apremio-individual/postgres-detail/${numeApre}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await res.json();
                if (res.ok) {
                    setData(result);
                } else {
                    setError(result.error || 'Error al recuperar detalles de Rentas');
                }
            } catch (err) {
                console.error('Error fetching postgres detail:', err);
                setError('Error de conexión con el servidor.');
            } finally {
                setLoading(false);
            }
        };

        fetchPostgresDetail();
    }, [numeApre]);

    if (!numeApre) return null;

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
    };

    const getEstadoBadge = (estado) => {
        const est = (estado || '').trim().toUpperCase();
        switch (est) {
            case 'D':
                return { label: 'Con Deuda', bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' };
            case 'P':
                return { label: 'Pagada', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' };
            case 'C':
                return { label: 'Cancelada', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
            case 'A':
                return { label: 'Anulada', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
            default:
                return { label: `Estado ${estado}`, bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.2)' };
        }
    };

    return (
        <div className="gr-modal-overlay">
            <div className="gr-modal-content">
                <div className="gr-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="gr-logo-icon">
                            <Scale size={20} color="#7c4dff" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#e2e8f0' }}>
                                Cédula GR: #{loading ? '...' : (data?.cedula?.cednro || '—')}
                            </h3>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                Mapeado con Apremio Origen: <strong>{numeApre}</strong>
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {!loading && data && (
                            <button 
                                className="gr-btn-print"
                                onClick={() => alert('Próximamente: Motor de PDF unificado con PostgreSQL')}
                                title="Imprimir Cédula de Rentas (Próximamente)"
                            >
                                <Printer size={15} />
                                <span>PDF</span>
                            </button>
                        )}
                        <button className="gr-close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {!loading && !error && data && (
                    <div className="gr-modal-tabs">
                        <button 
                            className={`gr-tab-btn ${activeTab === 'data' ? 'active' : ''}`}
                            onClick={() => setActiveTab('data')}
                        >
                            <FileText size={15} />
                            <span>Detalles de Cédula</span>
                        </button>
                        <button 
                            className={`gr-tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
                            onClick={() => setActiveTab('sql')}
                        >
                            <Database size={15} />
                            <span>Consultas SQL (PostgreSQL)</span>
                        </button>
                    </div>
                )}

                <div className="gr-modal-body">
                    {loading ? (
                        <div className="gr-loading-container">
                            <div className="gr-spinner"></div>
                            <p style={{ marginTop: '1rem', fontWeight: 500 }}>Consultando Rentas (PostgreSQL)...</p>
                            <small style={{ color: '#94a3b8' }}>Analizando estructuras del Apremio #{numeApre}</small>
                        </div>
                    ) : error ? (
                        <div className="gr-error-container">
                            <AlertCircle size={40} color="#ef4444" style={{ marginBottom: '1rem' }} />
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc' }}>Error en Consulta PostgreSQL</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>{error}</p>
                            <button className="gr-btn-retry" onClick={onClose} style={{ marginTop: '1.5rem' }}>
                                Cerrar Ventana
                            </button>
                        </div>
                    ) : activeTab === 'sql' ? (
                        <div className="gr-sql-layout">
                            <div className="gr-sql-intro">
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1rem', fontWeight: 700 }}>
                                    Esquema y Relación de Tablas de Rentas (PostgreSQL)
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
                                    Para construir la vista unificada de la cédula del Apremio <strong>{numeApre}</strong>, el sistema realiza consultas eficientes sobre 7 tablas del esquema de base de datos de PostgreSQL. A continuación, puedes inspeccionar los códigos SQL exactos ejecutados, con sus respectivos parámetros dinámicos resueltos.
                                </p>
                            </div>

                            <div className="gr-sql-grid">
                                {sqlQueries.map((q) => (
                                    <div className="gr-sql-card" key={q.id}>
                                        <div className="gr-sql-header">
                                            <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 700 }}>{q.title}</h5>
                                            <button 
                                                className={`gr-copy-btn ${copiedId === q.id ? 'copied' : ''}`}
                                                onClick={() => handleCopySql(q.id, q.sql)}
                                                title="Copiar consulta SQL"
                                            >
                                                {copiedId === q.id ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: '#64748b', lineHeight: '1.4' }}>
                                            {q.desc}
                                        </p>
                                        <div className="gr-sql-params">
                                            <span>Parámetros dinámicos aplicados: </span>
                                            <code>{q.params}</code>
                                        </div>
                                        <div className="gr-sql-code-container">
                                            <pre 
                                                className="gr-sql-pre"
                                                dangerouslySetInnerHTML={{ __html: highlightSQL(q.sql) }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="gr-data-layout">
                            {/* SECTION 1: CORE DATA CARDS */}
                            <div className="gr-cards-grid">
                                <div className="gr-card main-amount">
                                    <div className="card-label">Importe Cédula Rentas</div>
                                    <div className="card-value-large">{formatCurrency(data.cedula.cedimptot)}</div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                        <span className="gr-pill" style={{ 
                                            background: getEstadoBadge(data.cedula.cedestado).bg,
                                            color: getEstadoBadge(data.cedula.cedestado).color,
                                            border: getEstadoBadge(data.cedula.cedestado).border
                                        }}>
                                            {getEstadoBadge(data.cedula.cedestado).label}
                                        </span>
                                        <span className="gr-pill gray">
                                            Etapa: {data.cedula.cedetapa || '—'}
                                        </span>
                                    </div>
                                </div>

                                <div className="gr-card">
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div className="card-icon"><User size={16} /></div>
                                        <div style={{ flex: 1 }}>
                                            <div className="card-label">Contribuyente Titular</div>
                                            <div className="card-text-bold">{data.cedula.pernom || 'Persona no vinculada'}</div>
                                            <div className="card-subtext">Padrón PG: {data.cedula.cedpercod || '—'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="gr-card">
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div className="card-icon"><MapPin size={16} /></div>
                                        <div style={{ flex: 1 }}>
                                            <div className="card-label">Sector y Tipo</div>
                                            <div className="card-text-bold">{data.tipCedula?.tipceddsc || 'Apremio'} (Cód: {data.cedula.cedtpo})</div>
                                            <div className="card-subtext">Sector ID: {data.cedula.cedseccod || '—'} {data.sector ? `• F. Alt: ${new Date(data.sector.tipcedsecfchalt).toLocaleDateString()}` : ''}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="gr-card">
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div className="card-icon"><Calendar size={16} /></div>
                                        <div style={{ flex: 1 }}>
                                            <div className="card-label">Registro & Procesamiento</div>
                                            <div className="card-text-bold">Alta: {data.cedula.cedfchalt ? new Date(data.cedula.cedfchalt).toLocaleDateString() : '—'}</div>
                                            <div className="card-subtext">Usu: {data.cedula.cedusrprc?.trim()} • {data.cedula.cedfchprc ? new Date(data.cedula.cedfchprc).toLocaleDateString() : ''}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="gr-card gr-span-2" style={{ borderLeft: '3px solid #7c4dff', background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.05) 0%, rgba(11, 15, 25, 0.5) 100%)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Shield size={16} color="#9065ff" />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Mapeo y Paridad de Identificadores (Legacy ↔ PostgreSQL)
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                                            Relación de identificadores clave utilizados para la migración de datos entre la estructura original en MariaDB y el nuevo esquema en PostgreSQL.
                                        </p>
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'repeat(3, 1fr)', 
                                            gap: '1rem', 
                                            marginTop: '0.25rem' 
                                        }}>
                                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>Contribuyente (Percod)</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>Legacy:</span>
                                                        <strong>{data.legacyApremio?.CucuPers || '—'}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#a78bfa', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                        <span>Postgres (percod):</span>
                                                        <strong>{data.cedula.cedpercod || '—'}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>Cuenta / Tributo (Cuentct)</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>Legacy:</span>
                                                        <strong>{data.legacyApremio?.CuenCtct || '—'}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#a78bfa', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                        <span>Postgres (cuotrib):</span>
                                                        <strong>{data.cuotas?.[0]?.cedcuotribcod || '—'}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>Oficina / Sector (Codific)</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>Legacy:</span>
                                                        <strong>{data.legacyApremio?.CodiOfic || '—'}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#a78bfa', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                        <span>Postgres (seccod):</span>
                                                        <strong>{data.cedula.cedseccod || '—'}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {data.cedMotFin && (
                                    <div className="gr-card gr-span-2" style={{ borderLeft: '3px solid #10b981' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div className="card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><CheckCircle2 size={16} /></div>
                                            <div style={{ flex: 1 }}>
                                                <div className="card-label">Motivo de Cierre / Finalización</div>
                                                <div className="card-text-bold" style={{ color: '#10b981' }}>{data.cedMotFin.motfindsc?.trim()}</div>
                                                <div className="card-subtext">Código Motivo: {data.cedMotFin.motfincod}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {data.cedula.cedtexto?.trim() && (
                                    <div className="gr-card gr-span-2 text-obs">
                                        <div className="card-label">Descripción / Texto de la Cédula</div>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                                            {data.cedula.cedtexto.trim()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 2: HISTORY TIMELINE (cedinstancia) */}
                            <div className="gr-section-title">
                                <Activity size={16} color="#7c4dff" />
                                <span>Historial de Instancias (cedinstancia)</span>
                            </div>

                            <div className="gr-timeline-container">
                                {data.instances.length === 0 ? (
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '1rem' }}>
                                        No se registran instancias generadas en PostgreSQL para esta cédula.
                                    </p>
                                ) : (
                                    <div className="gr-timeline">
                                        {data.instances.map((inst, index) => (
                                            <div className="gr-timeline-item" key={index}>
                                                <div className="gr-timeline-badge">
                                                    <span>{index + 1}</span>
                                                </div>
                                                <div className="gr-timeline-content">
                                                    <div className="gr-timeline-header">
                                                        <span className="inst-dsc">{inst.tipcedinsdsc || `Código Instancia: ${inst.tipcedinscod}`}</span>
                                                        <span className="inst-date">
                                                            <Clock size={12} style={{ marginRight: '4px' }} />
                                                            {inst.cedinsfec ? new Date(inst.cedinsfec).toLocaleDateString() : '—'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', flexWrap: 'wrap' }}>
                                                        <span>Nro Cédula Instancia: <strong>{inst.cedinsnro || '—'}</strong></span>
                                                        <span>Origen: <strong>{inst.cedinsidnom?.trim() || '—'}</strong></span>
                                                        <span>Usuario: <strong>{inst.cedinsusrprc?.trim() || '—'}</strong></span>
                                                        {inst.cednrojuicio && (
                                                            <span style={{ color: '#818cf8', fontWeight: 600 }}>Juicio Nro: {inst.cednrojuicio.trim()}</span>
                                                        )}
                                                    </div>
                                                    {inst.cedinsobs?.trim() && inst.cedinsobs.trim() !== '0' && (
                                                        <div className="inst-obs">
                                                            <strong>Observación:</strong> {inst.cedinsobs.trim()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: APPLIED COST PARAMETERS (instanciacosto) */}
                            <div className="gr-section-title" style={{ marginTop: '2rem' }}>
                                <Settings size={16} color="#7c4dff" />
                                <span>Parámetros de Costo de Instancia (instanciacosto)</span>
                            </div>

                            <div className="gr-table-container">
                                {data.costs.length === 0 ? (
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', padding: '1rem' }}>
                                        No hay coeficientes de costo definidos en Postgres para los tipos de instancias aplicados.
                                    </p>
                                ) : (
                                    <table className="gr-table">
                                        <thead>
                                            <tr>
                                                <th>Tipo Instancia</th>
                                                <th style={{ textAlign: 'right' }}>Valor Fijo</th>
                                                <th style={{ textAlign: 'right' }}>Porcentaje</th>
                                                <th style={{ textAlign: 'right' }}>Valor Mínimo</th>
                                                <th style={{ textAlign: 'right' }}>Valor Máximo</th>
                                                <th style={{ textAlign: 'right' }}>Viático / Envío</th>
                                                <th>Vigencia Desde</th>
                                                <th>Modificador</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.costs.map((cost, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                                        {cost.tipcedinsdsc || `Cod: ${cost.tipcedinscod}`}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                                        {parseFloat(cost.inscosval) > 0 ? formatCurrency(cost.inscosval) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#818cf8', fontWeight: 600 }}>
                                                        {parseFloat(cost.inscospor) > 0 ? `${parseFloat(cost.inscospor).toFixed(2)}%` : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                                        {parseFloat(cost.inscosvalmin) > 0 ? formatCurrency(cost.inscosvalmin) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                                        {parseFloat(cost.inscosvalmax) > 0 ? formatCurrency(cost.inscosvalmax) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>
                                                        {parseFloat(cost.inscosviat) > 0 ? formatCurrency(cost.inscosviat) : '—'}
                                                    </td>
                                                    <td>
                                                        {cost.inscosalta ? new Date(cost.inscosalta).toLocaleDateString() : '—'}
                                                    </td>
                                                    <td style={{ fontSize: '0.75rem', opacity: 0.8 }} title={cost.inscosusrprc}>
                                                        {cost.inscosusrprc?.trim()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .gr-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(4, 6, 12, 0.85);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    animation: grFadeIn 0.25s ease-out;
                }
                .gr-modal-content {
                    background: #0b0f19;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 1.25rem;
                    width: 92%;
                    max-width: 950px;
                    height: 88vh;
                    max-height: 850px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
                    overflow: hidden;
                    animation: grScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .gr-modal-header {
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                    background: rgba(255, 255, 255, 0.01);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .gr-logo-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    background: rgba(124, 77, 255, 0.1);
                    border: 1px solid rgba(124, 77, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .gr-btn-print {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(124, 77, 255, 0.15);
                    border: 1px solid rgba(124, 77, 255, 0.3);
                    border-radius: 8px;
                    color: #a78bfa;
                    padding: 6px 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .gr-btn-print:hover {
                    background: #7c4dff;
                    color: #fff;
                    box-shadow: 0 0 12px rgba(124, 77, 255, 0.4);
                }
                .gr-close-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }
                .gr-close-btn:hover {
                    color: #f8fafc;
                }
                .gr-modal-body {
                    padding: 1.5rem;
                    flex: 1;
                    overflow-y: auto;
                    background: radial-gradient(circle at top right, rgba(124, 77, 255, 0.03), transparent 400px);
                }
                
                /* Loading & Error States */
                .gr-loading-container, .gr-error-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 4rem 2rem;
                    text-align: center;
                    color: #f8fafc;
                }
                .gr-spinner {
                    width: 45px;
                    height: 45px;
                    border: 3.5px solid rgba(124, 77, 255, 0.1);
                    border-top-color: #7c4dff;
                    border-radius: 50%;
                    animation: grSpin 1s linear infinite;
                }
                .gr-btn-retry {
                    padding: 10px 20px;
                    background: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: #f8fafc;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .gr-btn-retry:hover {
                    background: #334155;
                    border-color: rgba(255, 255, 255, 0.2);
                }

                /* Data Layout */
                .gr-data-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .gr-cards-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                }
                @media (max-width: 768px) {
                    .gr-cards-grid {
                        grid-template-columns: 1fr;
                    }
                    .gr-span-2 {
                        grid-column: span 1 !important;
                    }
                }
                .gr-card {
                    background: rgba(30, 41, 59, 0.35);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 0.75rem;
                    padding: 1rem;
                }
                .gr-span-2 {
                    grid-column: span 2;
                }
                .gr-card.main-amount {
                    background: linear-gradient(135deg, rgba(124, 77, 255, 0.08), rgba(30, 41, 59, 0.35));
                    border: 1px solid rgba(124, 77, 255, 0.15);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .card-label {
                    font-size: 0.68rem;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #94a3b8;
                    margin-bottom: 4px;
                    font-weight: 700;
                }
                .card-value-large {
                    font-size: 1.8rem;
                    font-weight: 900;
                    color: #fff;
                    font-family: 'Outfit', sans-serif;
                }
                .gr-pill {
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .gr-pill.gray {
                    background: rgba(255, 255, 255, 0.05);
                    color: #cbd5e1;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                .card-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .card-text-bold {
                    font-weight: 700;
                    color: #f8fafc;
                    font-size: 0.95rem;
                }
                .card-subtext {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-top: 2px;
                }
                .gr-card.text-obs {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }

                /* Sections and Lists */
                .gr-section-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #f8fafc;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                
                /* Timeline style */
                .gr-timeline-container {
                    padding-left: 0.5rem;
                }
                .gr-timeline {
                    position: relative;
                    border-left: 2px solid rgba(124, 77, 255, 0.15);
                    margin-left: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .gr-timeline-item {
                    position: relative;
                    padding-left: 24px;
                }
                .gr-timeline-badge {
                    position: absolute;
                    left: -11px;
                    top: 2px;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #7c4dff;
                    border: 3px solid #0b0f19;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-size: 9px;
                    font-weight: 800;
                }
                .gr-timeline-content {
                    background: rgba(30, 41, 59, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    border-radius: 8px;
                    padding: 0.75rem 1rem;
                }
                .gr-timeline-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                    padding-bottom: 4px;
                }
                .inst-dsc {
                    font-weight: 700;
                    color: #f8fafc;
                    font-size: 0.88rem;
                }
                .inst-date {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                }
                .inst-obs {
                    margin-top: 6px;
                    padding: 6px 10px;
                    background: rgba(15, 23, 42, 0.3);
                    border-radius: 6px;
                    font-size: 0.78rem;
                    color: #cbd5e1;
                    border-left: 2.5px solid rgba(124, 77, 255, 0.4);
                }

                /* Table style */
                .gr-table-container {
                    background: rgba(15, 23, 42, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    border-radius: 0.75rem;
                    overflow: hidden;
                    max-width: 100%;
                    overflow-x: auto;
                }
                .gr-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                    color: #cbd5e1;
                }
                .gr-table th {
                    background: rgba(255, 255, 255, 0.02);
                    padding: 0.75rem 1rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #94a3b8;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    text-align: left;
                }
                .gr-table td {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                }
                .gr-table tbody tr:hover {
                    background: rgba(255, 255, 255, 0.01);
                }

                /* Tabs Navigation Style */
                .gr-modal-tabs {
                    display: flex;
                    background: rgba(15, 23, 42, 0.4);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 0.5rem 1.5rem;
                    gap: 0.75rem;
                }
                .gr-tab-btn {
                    background: none;
                    border: 1px solid transparent;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                .gr-tab-btn:hover {
                    color: #e2e8f0;
                    background: rgba(255, 255, 255, 0.02);
                }
                .gr-tab-btn.active {
                    color: #a78bfa;
                    background: rgba(124, 77, 255, 0.1);
                    border: 1px solid rgba(124, 77, 255, 0.2);
                    box-shadow: 0 0 12px rgba(124, 77, 255, 0.1);
                }

                /* SQL Viewer Style */
                .gr-sql-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    animation: grFadeIn 0.25s ease-out;
                }
                .gr-sql-intro {
                    background: rgba(30, 41, 59, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    border-radius: 10px;
                    padding: 1rem;
                }
                .gr-sql-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.25rem;
                }
                @media (max-width: 900px) {
                    .gr-sql-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .gr-sql-card {
                    background: rgba(30, 41, 59, 0.35);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                }
                .gr-sql-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .gr-copy-btn {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 6px;
                    color: #94a3b8;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .gr-copy-btn:hover {
                    background: rgba(124, 77, 255, 0.15);
                    border-color: rgba(124, 77, 255, 0.3);
                    color: #a78bfa;
                }
                .gr-copy-btn.copied {
                    background: rgba(16, 185, 129, 0.15);
                    border-color: rgba(16, 185, 129, 0.3);
                    color: #10b981;
                }
                .gr-sql-params {
                    font-size: 0.72rem;
                    color: #94a3b8;
                    margin-bottom: 0.75rem;
                }
                .gr-sql-params code {
                    background: rgba(15, 23, 42, 0.6);
                    color: #e2e8f0;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: monospace;
                }
                .gr-sql-code-container {
                    position: relative;
                    background: #020617;
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 8px;
                    padding: 1rem;
                    overflow-x: auto;
                    flex: 1;
                }
                .gr-sql-pre {
                    font-family: 'Fira Code', 'Courier New', monospace;
                    font-size: 0.8rem;
                    line-height: 1.5;
                    color: #38bdf8;
                    margin: 0;
                    white-space: pre-wrap;
                    word-break: break-all;
                }

                /* Animations */
                @keyframes grFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes grScaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes grSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
};

export default PostgresCedulaModal;
