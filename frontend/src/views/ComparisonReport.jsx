import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, AlertCircle, Filter, Download, ArrowRight, X } from 'lucide-react';
import API_BASE_URL from '../config';

const ComparisonReport = () => {
    const [offices, setOffices] = useState([]);
    const [selectedOffice, setSelectedOffice] = useState('1');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [pageSize] = useState(20);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [concepts, setConcepts] = useState([]);
    const [filterConcept, setFilterConcept] = useState('');
    const [exportLoading, setExportLoading] = useState(false);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('nomade_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/ctacte-fn/offices`, {
            headers: getAuthHeaders()
        })
            .then(res => res.json())
            .then(data => setOffices(data))
            .catch(err => console.error('Error fetching offices:', err));
    }, []);

    useEffect(() => {
        setFilterConcept('');
        if (selectedOffice) {
            fetch(`${API_BASE_URL}/api/ctacte-fn/concepts?officeId=${selectedOffice}`, {
                headers: getAuthHeaders()
            })
                .then(res => res.json())
                .then(data => setConcepts(data))
                .catch(err => console.error('Error fetching concepts:', err));
        }
    }, [selectedOffice]);

    const hasAllRequiredFilters = !!(selectedOffice && filterYear && filterMonth && filterConcept);

    const fetchData = async (pageNum = 1) => {
        const hasSearch = !!(search && search.trim());
        if (!hasAllRequiredFilters && !hasSearch) {
            setError("Por favor, seleccione todos los filtros requeridos (Año, Cuota y Concepto) o ingrese un padrón específico para realizar la búsqueda.");
            setData([]);
            setTotalPages(0);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const url = `${API_BASE_URL}/api/ctacte-fn/report/comparison?officeId=${selectedOffice}&page=${pageNum}&limit=${pageSize}&search=${encodeURIComponent(search)}&filterYear=${filterYear}&filterMonth=${filterMonth}&filterConcept=${encodeURIComponent(filterConcept)}`;
            const res = await fetch(url, {
                headers: getAuthHeaders()
            });
            const result = await res.json();
            
            if (result.error) throw new Error(result.error);
            
            setData(result.data);
            setTotalPages(Math.ceil(result.total / pageSize));
            setPage(pageNum);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = async () => {
        if (!hasAllRequiredFilters) {
            alert("Seleccione más filtros para continuar");
            return;
        }
        
        setExportLoading(true);
        setError(null);
        try {
            const url = `${API_BASE_URL}/api/ctacte-fn/report/comparison?export=true&officeId=${selectedOffice}&filterYear=${filterYear}&filterMonth=${filterMonth}&filterConcept=${encodeURIComponent(filterConcept)}`;
            const res = await fetch(url, {
                headers: getAuthHeaders()
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Error HTTP ${res.status}`);
            }
            
            const result = await res.json();
            
            if (result.error) throw new Error(result.error);
            if (!result.data || result.data.length === 0) {
                alert("No hay datos para exportar");
                return;
            }

            // Convert to CSV
            const headers = [
                "Cuenta/Padron",
                "Nombre/Denominacion",
                "CUIT",
                "Total MD ($)",
                "Total PG ($)",
                "DIFERENCIA ($)"
            ];

            const rows = result.data.map(r => [
                r.cuenta,
                r.nombre,
                r.cuit,
                r.maria?.total?.toFixed(2) ?? '',
                r.postgres?.total?.toFixed(2) ?? '',
                r.diffTotal?.toFixed(2) ?? ''
            ]);

            const csvContent = "\uFEFF" + [
                headers.join(";"),
                ...rows.map(e => e.map(val => {
                    if (val === null || val === undefined) return "";
                    // Replace semicolons to avoid breaking columns and wrap strings in quotes
                    const str = val.toString().replace(/;/g, ",");
                    return `"${str}"`;
                }).join(";"))
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const urlBlob = URL.createObjectURL(blob);
            link.setAttribute("href", urlBlob);
            const conceptFilename = filterConcept.toLowerCase().replace(/[^a-z0-9]/g, "_");
            link.setAttribute("download", `compara_ctacte_ofic_${selectedOffice}_${filterYear}_cuota_${filterMonth}_${conceptFilename}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            setError("Error al descargar CSV: " + err.message);
        } finally {
            setExportLoading(false);
        }
    };


    useEffect(() => {
        fetchData(1);
    }, [selectedOffice]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
    };

    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isFullDetailOpen, setIsFullDetailOpen] = useState(false);
    const [fullDetailLoading, setFullDetailLoading] = useState(false);
    const [mariaFull, setMariaFull] = useState([]);
    const [pgFull, setPgFull] = useState([]);

    const consolidateData = (data) => {
        if (!Array.isArray(data)) return [];
        const groups = {};
        data.forEach(row => {
            let p = parseInt(row.PeriCtct);
            let b = parseInt(row.BimeCtct);
            const concept = (row.DetaCtct || '').toString().trim();
            const conceptLower = concept.toLowerCase();
            const key = p <= 2018 ? `2018-99-${conceptLower}` : `${p}-${b}-${conceptLower}`;
            
            if (!groups[key]) {
                groups[key] = {
                    PeriCtct: p <= 2018 ? 2018 : p,
                    BimeCtct: p <= 2018 ? 99 : b,
                    Concept: concept || 'Sin Concepto',
                    FeveCtct: row.FeveCtct,
                    DebeCtct: 0,
                    RecaCtct: 0,
                    CredCtct: 0,
                    TotaCtct: 0,
                    isLegacyGroup: p <= 2018
                };
            }
            groups[key].DebeCtct += parseFloat(row.DebeCtct || 0);
            groups[key].RecaCtct += parseFloat(row.RecaCtct || 0);
            groups[key].CredCtct += parseFloat(row.CredCtct || row.Pagado || 0);
            groups[key].TotaCtct += parseFloat(row.TotaCtct || 0);
            
            if (row.FeveCtct && (!groups[key].FeveCtct || new Date(row.FeveCtct) > new Date(groups[key].FeveCtct))) {
                groups[key].FeveCtct = row.FeveCtct;
            }
        });
        return Object.values(groups).sort((a, b) => {
            if (b.PeriCtct !== a.PeriCtct) return b.PeriCtct - a.PeriCtct;
            if (b.BimeCtct !== a.BimeCtct) return b.BimeCtct - a.BimeCtct;
            return a.Concept.localeCompare(b.Concept);
        });
    };

    const fetchFullDetail = async (account) => {
        setFullDetailLoading(true);
        try {
            const [mRes, pRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/ctacte-fn/legacy/search?account=${account.cuenta}&officeId=${selectedOffice}&agrupar=true&filterYear=${filterYear}&filterMonth=${filterMonth}`, { headers: getAuthHeaders() }).then(r => r.json()),
                fetch(`${API_BASE_URL}/api/ctacte-fn/new/search?account=${account.cuenta}&officeId=${selectedOffice}&showQuotaDetail=true&filterYear=${filterYear}&filterMonth=${filterMonth}`, { headers: getAuthHeaders() }).then(r => r.json())
            ]);

            let mariaMerged = consolidateData(mRes);
            let pgMerged = consolidateData(pRes);

            if (filterConcept) {
                mariaMerged = mariaMerged.filter(r => (r.Concept || '').toLowerCase() === filterConcept.toLowerCase());
                pgMerged = pgMerged.filter(r => (r.Concept || '').toLowerCase() === filterConcept.toLowerCase());
            }

            const allPeriods = Array.from(new Set([
                ...mariaMerged.map(r => `${r.PeriCtct}-${r.BimeCtct}-${(r.Concept || '').toLowerCase()}`),
                ...pgMerged.map(r => `${r.PeriCtct}-${r.BimeCtct}-${(r.Concept || '').toLowerCase()}`)
            ])).sort((a,b) => {
                const [pA, bA, cA] = a.split('-');
                const [pB, bB, cB] = b.split('-');
                if (Number(pB) !== Number(pA)) return Number(pB) - Number(pA);
                if (Number(bB) !== Number(bA)) return Number(bB) - Number(bA);
                return (cA || '').localeCompare(cB || '');
            });

            const unified = allPeriods.map(key => {
                const [pStr, bStr, ...cParts] = key.split('-');
                const p = Number(pStr);
                const b = Number(bStr);
                const cLower = cParts.join('-');
                const m = mariaMerged.find(r => r.PeriCtct === p && r.BimeCtct === b && (r.Concept || '').toLowerCase() === cLower) || { DebeCtct: 0, RecaCtct: 0, CredCtct: 0, TotaCtct: 0, Concept: '' };
                const pg = pgMerged.find(r => r.PeriCtct === p && r.BimeCtct === b && (r.Concept || '').toLowerCase() === cLower) || { DebeCtct: 0, RecaCtct: 0, CredCtct: 0, TotaCtct: 0, Concept: '' };
                
                const mTotal = m.DebeCtct + m.RecaCtct;
                const mSaldo = mTotal - m.CredCtct;
                const pgTotal = pg.DebeCtct + pg.RecaCtct;
                const pgSaldo = pgTotal - pg.CredCtct;
                
                const diff = Math.abs(mSaldo - pgSaldo);
                return { key, p, b, conceptName: m.Concept || pg.Concept || 'Sin Concepto', m: { ...m, TotaCtct: mTotal, Saldo: mSaldo }, pg: { ...pg, TotaCtct: pgTotal, Saldo: pgSaldo }, diff, hasDiff: diff > 1.5 };
            });

            setUnifiedFull(unified);
            setIsFullDetailOpen(true);
        } catch (err) {
            console.error('Error fetching full detail:', err);
        } finally {
            setFullDetailLoading(false);
        }
    };

    const generatePDF = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        
        doc.setFontSize(16);
        doc.text(`Informe de Auditoría - Padrón #${selectedAccount.cuenta}`, 15, 20);
        doc.setFontSize(10);
        doc.text(`Titular: ${selectedAccount.nombre || 'N/A'} | Oficina: ${selectedOffice}`, 15, 28);
        doc.text(`Fecha de Reporte: ${new Date().toLocaleString()}`, 15, 34);

        const tableBody = unifiedFull.map(row => [
            `${row.p}/${row.b === 99 ? 'ANT.' : row.b} - ${row.conceptName}`,
            formatCurrency(row.m.DebeCtct),
            formatCurrency(row.m.RecaCtct),
            formatCurrency(row.m.CredCtct),
            formatCurrency(row.m.Saldo),
            formatCurrency(row.pg.DebeCtct),
            formatCurrency(row.pg.RecaCtct),
            formatCurrency(row.pg.CredCtct),
            formatCurrency(row.pg.Saldo),
            formatCurrency(row.diff)
        ]);

        const totals = {
            mD: unifiedFull.reduce((s, r) => s + r.m.DebeCtct, 0),
            mR: unifiedFull.reduce((s, r) => s + r.m.RecaCtct, 0),
            mC: unifiedFull.reduce((s, r) => s + r.m.CredCtct, 0),
            mS: unifiedFull.reduce((s, r) => s + r.m.Saldo, 0),
            pD: unifiedFull.reduce((s, r) => s + r.pg.DebeCtct, 0),
            pR: unifiedFull.reduce((s, r) => s + r.pg.RecaCtct, 0),
            pC: unifiedFull.reduce((s, r) => s + r.pg.CredCtct, 0),
            pS: unifiedFull.reduce((s, r) => s + r.pg.Saldo, 0),
            diff: unifiedFull.reduce((s, r) => s + r.diff, 0)
        };

        tableBody.push([
            'TOTALES',
            formatCurrency(totals.mD), formatCurrency(totals.mR), formatCurrency(totals.mC), formatCurrency(totals.mS),
            formatCurrency(totals.pD), formatCurrency(totals.pR), formatCurrency(totals.pC), formatCurrency(totals.pS),
            formatCurrency(totals.diff)
        ]);

        doc.autoTable({
            startY: 40,
            head: [['Periodo', 'MD Capital', 'MD Interés', 'MD Pagado', 'MD Saldo', 'PG Capital', 'PG Interés', 'PG Pagado', 'PG Saldo', 'Diff']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [0, 74, 117], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 20 },
                9: { fontStyle: 'bold' }
            },
            didParseCell: function(data) {
                if (data.row.index === tableBody.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        doc.save(`Auditoria_Padron_${selectedAccount.cuenta}.pdf`);
    };

    const [unifiedFull, setUnifiedFull] = useState([]);

    const openSummary = (account) => {
        setSelectedAccount(account);
        setIsSummaryOpen(true);
    };

    const openFullDetail = (account) => {
        setSelectedAccount(account);
        fetchFullDetail(account);
    };

    return (
        <div className="view-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto', background: '#0a0b10' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                        Compara Ctacte Listado
                    </h1>
                    <p style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>Auditoría masiva de migración: MariaDB vs PostgreSQL</p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(124, 77, 255, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '8px' }}>
                            <Filter size={16} color="var(--primary)" />
                            <select 
                                style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: '600', cursor: 'pointer', outline: 'none' }}
                                value={selectedOffice}
                                onChange={(e) => setSelectedOffice(e.target.value)}
                            >
                                {offices.map(o => (
                                    <option key={o.id} value={o.id} style={{ background: '#1a1b23' }}>{o.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(251, 191, 36, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: '600' }}>Año:</span>
                            <input
                                type="number"
                                placeholder="Todos"
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
                                style={{ background: 'transparent', border: 'none', color: 'white', width: '60px', fontSize: '0.9rem', fontWeight: 'bold', outline: 'none' }}
                            />
                        </div>

                        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(251, 191, 36, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: '600' }}>Cuota:</span>
                            <input
                                type="number"
                                placeholder="Todas"
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
                                style={{ background: 'transparent', border: 'none', color: 'white', width: '55px', fontSize: '0.9rem', fontWeight: 'bold', outline: 'none' }}
                            />
                        </div>

                        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(251, 191, 36, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: '600' }}>Concepto:</span>
                            <select 
                                style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold', outline: 'none', maxWidth: '180px', fontSize: '0.9rem' }}
                                value={filterConcept}
                                onChange={(e) => setFilterConcept(e.target.value)}
                            >
                                <option value="" style={{ background: '#1a1b23' }}>Todos</option>
                                {concepts.map(c => (
                                    <option key={c} value={c} style={{ background: '#1a1b23' }}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="search-box" style={{ position: 'relative', width: '240px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Buscar padrón..."
                                style={{ 
                                    padding: '0.6rem 1rem 0.6rem 2.5rem', 
                                    width: '100%', 
                                    background: 'rgba(0,0,0,0.2)', 
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '0.9rem'
                                }}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
                            />
                        </div>
                        
                        <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            onClick={() => fetchData(1)}
                        >
                            <Search size={18} />
                            Buscar
                        </button>

                        <button 
                            className="btn btn-success" 
                            style={{ 
                                padding: '0.3rem 0.6rem', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center', 
                                justifyContent: 'center',
                                background: hasAllRequiredFilters ? '#10b981' : '#4b5563',
                                cursor: hasAllRequiredFilters ? 'pointer' : 'not-allowed',
                                border: 'none',
                                color: 'white',
                                opacity: hasAllRequiredFilters ? 1 : 0.6,
                                height: 'auto',
                                minWidth: '80px',
                                textAlign: 'center'
                            }}
                            onClick={downloadCSV}
                            disabled={!hasAllRequiredFilters || exportLoading}
                            title={!hasAllRequiredFilters ? "Seleccione Oficina, Año, Cuota y Concepto para descargar" : "Descargar Excel/CSV completo"}
                        >
                            {exportLoading ? (
                                <div style={{ border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid white', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}></div>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span style={{ fontSize: '0.65rem', fontWeight: '700', marginTop: '2px', lineHeight: '1' }}>EXPORTAR<br/>CSV</span>
                                </>
                            )}
                        </button>
                    </div>
                    {exportLoading && (
                        <div style={{ color: '#10b981', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                            <div style={{ border: '2px solid rgba(16, 185, 129, 0.2)', borderTop: '2px solid #10b981', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }}></div>
                            <span>Generando...</span>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="error-card" style={{ marginBottom: '1rem', background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertCircle size={20} />
                    <span>Error: {error}</span>
                </div>
            )}
            <div className="card" style={{ padding: '0', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem' }}>Padrón / Persona</th>
                                <th style={{ padding: '1rem' }}>Cod. MariaDB</th>
                                <th style={{ padding: '1rem', textAlign: 'center', borderLeft: '2px solid var(--border)' }}>TOTAL MD</th>
                                <th style={{ padding: '1rem', textAlign: 'center', borderLeft: '4px solid var(--border)' }}>TOTAL PG</th>
                                <th style={{ padding: '1rem', textAlign: 'center', borderLeft: '2px solid var(--border)' }}>DIF.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Cargando datos...</td></tr>
                                ))
                            ) : data.length > 0 ? (
                                data.map((row) => (
                                    <tr key={row.cuenta} className="table-row">
                                        <td style={{ padding: '1rem' }}>
                                            <div 
                                                onClick={() => openSummary(row)}
                                                style={{ fontWeight: '600', cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                                            >
                                                {row.cuenta.toString().startsWith('#') ? '' : '#'}{row.cuenta}
                                            </div>
                                            {row.accountName && (
                                                <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 'bold', marginTop: '2px' }}>
                                                    {row.accountName}
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{row.nombre}</div>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                            <div 
                                                onClick={() => openFullDetail(row)}
                                                style={{ cursor: 'pointer', color: '#10b981', textDecoration: 'underline' }}
                                            >
                                                {row.cuit || 'N/A'}
                                            </div>
                                            <div style={{ opacity: 0.5, fontSize: '0.7rem' }}>Cuen: {row.cuenta} / Ofic: {row.officeId}</div>
                                        </td>
                                        
                                        {/* MariaDB Side */}
                                        <td style={{ padding: '1rem', textAlign: 'right', borderLeft: '2px solid var(--border)' }}>
                                            {formatCurrency(row.maria.total)}
                                        </td>

                                        {/* Postgres Side */}
                                        <td style={{ padding: '1rem', textAlign: 'right', borderLeft: '4px solid var(--border)' }}>
                                            {formatCurrency(row.postgres.total)}
                                        </td>

                                        {/* Difference */}
                                        <td style={{ padding: '1rem', textAlign: 'right', borderLeft: '2px solid var(--border)', color: (row.diffTotal !== undefined ? row.diffTotal : Math.abs(row.maria.total - row.postgres.total)) > 1 ? '#ef4444' : '#10b981' }}>
                                            {formatCurrency(row.diffTotal !== undefined ? row.diffTotal : Math.abs(row.maria.total - row.postgres.total))}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center' }}>No se encontraron registros en esta oficina.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination" style={{ padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <button 
                        className="btn btn-secondary" 
                        disabled={page === 1 || loading}
                        onClick={() => fetchData(page - 1)}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span style={{ fontSize: '0.9rem' }}>Página <strong>{page}</strong> de {totalPages}</span>
                    <button 
                        className="btn btn-secondary" 
                        disabled={page === totalPages || loading}
                        onClick={() => fetchData(page + 1)}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
            
            {/* Summary Modal */}
            {isSummaryOpen && selectedAccount && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem'
                }}>
                    <div style={{
                        background: '#1a1b23',
                        width: '100%',
                        maxWidth: '900px',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'white' }}>Resumen de Auditoría: #{selectedAccount.cuenta}</h2>
                                    <span style={{ 
                                        padding: '0.25rem 0.75rem', 
                                        background: 'rgba(124, 77, 255, 0.15)', 
                                        color: 'var(--primary)', 
                                        borderRadius: '6px', 
                                        fontSize: '0.75rem', 
                                        fontWeight: '700' 
                                    }}>OFICINA {selectedAccount.officeId}</span>
                                </div>
                                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{selectedAccount.nombre}</p>
                            </div>
                            <button 
                                onClick={() => setIsSummaryOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* MariaDB Card */}
                            <div style={{ background: 'rgba(124, 77, 255, 0.03)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(124, 77, 255, 0.1)' }}>
                                <h3 style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                                    SISTEMA MARIA DB
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>Deuda Pre-2018:</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedAccount.maria.anterior)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>Total (Hoy):</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white' }}>{formatCurrency(selectedAccount.maria.total)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Postgres Card */}
                            <div style={{ background: 'rgba(16, 185, 129, 0.03)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                <h3 style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                                    SISTEMA POSTGRE SQL
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>Deuda Pre-2018:</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedAccount.postgres.anterior)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>Saldo Migrado:</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'white' }}>{formatCurrency(selectedAccount.postgres.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Detail Modal (Quota by Quota) */}
            {isFullDetailOpen && selectedAccount && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.92)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#0d0d12',
                        width: '100%',
                        height: '100%',
                        maxHeight: '95vh',
                        maxWidth: '1400px',
                        borderRadius: '24px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    Desglose Detallado de Auditoría
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: '400' }}>Padrón #{selectedAccount.cuenta} - {selectedAccount.nombre}</span>
                                </h2>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button 
                                    onClick={generatePDF}
                                    style={{ 
                                        background: 'var(--primary)', 
                                        border: 'none', 
                                        color: 'white', 
                                        padding: '0.6rem 1.2rem', 
                                        borderRadius: '12px', 
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontWeight: '700'
                                    }}
                                >
                                    <Download size={18} /> Exportar PDF Auditoría
                                </button>
                                <button 
                                    onClick={() => setIsFullDetailOpen(false)}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '50%', cursor: 'pointer' }}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
                            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#0d0d12', zIndex: 10, position: 'sticky', top: 0 }}>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-dim)' }}>Periodo</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', background: 'rgba(124, 77, 255, 0.05)', color: 'var(--primary)' }} colSpan="4">MARIA DB</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981' }} colSpan="4">POSTGRE SQL</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#ef4444' }}>DIFF SALDO</th>
                                    </tr>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', fontSize: '0.75rem' }}>
                                        <th style={{ padding: '0.5rem' }}>Año/Cuota</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Capital+Int</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Pagado</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>Saldo MD</th>
                                        <th style={{ padding: '0.5rem', borderRight: '2px solid var(--border)' }}></th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Capital+Int</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Pagado</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>Saldo PG</th>
                                        <th style={{ padding: '0.5rem', borderRight: '2px solid var(--border)' }}></th>
                                        <th style={{ padding: '0.5rem' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unifiedFull.map((row) => (
                                        <tr key={row.key} style={{ 
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            background: row.hasDiff ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                                            transition: 'background 0.2s'
                                        }}>
                                            <td style={{ padding: '0.75rem', fontWeight: row.b === 99 ? '800' : '400', color: row.b === 99 ? 'var(--primary)' : 'inherit' }}>
                                                <div>{row.p}/{row.b === 99 ? 'ANT.' : row.b}</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '4px', fontWeight: 'normal', color: '#fbbf24' }}>{row.conceptName}</div>
                                            </td>
                                            
                                            {/* MariaDB Side */}
                                            <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.8 }}>{formatCurrency(row.m.TotaCtct)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.8, color: '#10b981' }}>{formatCurrency(row.m.CredCtct)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(row.m.Saldo)}</td>
                                            <td style={{ borderRight: '2px solid var(--border)' }}></td>

                                            {/* Postgres Side */}
                                            <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.8 }}>{formatCurrency(row.pg.TotaCtct)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.8, color: '#10b981' }}>{formatCurrency(row.pg.CredCtct)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(row.pg.Saldo)}</td>
                                            <td style={{ borderRight: '2px solid var(--border)' }}></td>

                                            {/* Difference */}
                                            <td style={{ 
                                                padding: '0.75rem', 
                                                textAlign: 'right', 
                                                fontWeight: '800', 
                                                color: row.hasDiff ? '#ef4444' : '#10b981'
                                            }}>
                                                {formatCurrency(row.diff)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot style={{ background: '#13141f', borderTop: '2px solid var(--border)', position: 'sticky', bottom: 0 }}>
                                    <tr style={{ fontWeight: '800', color: 'white' }}>
                                        <td style={{ padding: '1rem' }}>TOTALES</td>
                                        
                                        {/* MariaDB Totals */}
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            {formatCurrency(unifiedFull.reduce((sum, r) => sum + r.m.TotaCtct, 0))}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981' }}>
                                            {formatCurrency(unifiedFull.reduce((sum, r) => sum + r.m.CredCtct, 0))}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', background: 'rgba(124, 77, 255, 0.1)' }}>
                                            {formatCurrency(unifiedFull.reduce((sum, r) => sum + r.m.Saldo, 0))}
                                        </td>
                                        <td style={{ borderRight: '2px solid var(--border)' }}></td>

                                        {/* Postgres Totals */}
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            {formatCurrency(unifiedFull.reduce((sum, r) => sum + r.pg.TotaCtct, 0))}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981' }}>
                                            {formatCurrency(unifiedFull.reduce((sum, r) => sum + r.pg.CredCtct, 0))}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', background: 'rgba(16, 185, 129, 0.1)' }}>
                                            {formatCurrency(unifiedFull.reduce((sum, r) => sum + r.pg.Saldo, 0))}
                                        </td>
                                        <td style={{ borderRight: '2px solid var(--border)' }}></td>

                                        {/* Total Difference */}
                                        <td style={{ 
                                            padding: '1rem', 
                                            textAlign: 'right', 
                                            background: 'rgba(239, 68, 68, 0.1)', 
                                            color: '#ef4444'
                                        }}>
                                            {formatCurrency(Math.abs(
                                                unifiedFull.reduce((sum, r) => sum + r.m.Saldo, 0) - 
                                                unifiedFull.reduce((sum, r) => sum + r.pg.Saldo, 0)
                                            ))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Loading Overlay for Details */}
            {fullDetailLoading && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
                    <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{ __html: `
                .table-row { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; }
                .table-row:hover { background: rgba(255,255,255,0.05); }
                .btn-secondary:disabled { opacity: 0.3; cursor: not-allowed; }
                .form-select option { background: #1a1b23; color: white; }
            `}} />
        </div>
    );
};

export default ComparisonReport;
