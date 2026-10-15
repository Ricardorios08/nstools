import React, { useState, useEffect } from 'react';
import { 
    Search, FileText, User, MapPin, Calendar, Gavel, 
    CheckCircle, AlertCircle, ArrowRight, Clock,
    DollarSign, Scale, Printer, ArrowLeft, Info,
    Download, ChevronLeft, ChevronRight, FileDown, Loader2, Filter,
    Table, History
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URL } from '../config';
import PostgresCedulaModal from '../components/PostgresCedulaModal';

const ApremioIndividualReport = () => {
    const [viewMode, setViewMode] = useState('search'); 
    const [selectedGrNumeApre, setSelectedGrNumeApre] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [statuses, setStatuses] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [totalResults, setTotalResults] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState(null);
    const [previewPdf, setPreviewPdf] = useState(null);

    const API_BASE = API_URL;
    const LIMIT = 20;

    const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val || 0);
    const formatDate = (dateString) => {
        if (!dateString || dateString === '0000-00-00' || dateString === 'null') return '-';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('es-AR');
    };

    const processClaimedInstallments = (detailData) => {
        if (!detailData) return [];
        const { claimedInstallments, debt } = detailData;

        const groups = {};
        const interestConcepts = ['13030201', '13030203'];
        const expenseConcepts = ['91010400', '91010500'];

        if (claimedInstallments && claimedInstallments.length > 0) {
            claimedInstallments.forEach(c => {
                const bime = parseInt(c.BimeCtct || 0);
                if (bime <= 0) return;

                // Excluir conceptos de gastos, comisiones y honorarios de apremio (comienzan con 9)
                const conceptCode = (c.CodiConc || c.CodiConcDeta || '').toString().trim();
                if (conceptCode.startsWith('9')) return;

                const key = `${c.PeriCtct}-${c.BimeCtct}`;
                if (!groups[key]) {
                    groups[key] = {
                        PeriCtct: parseInt(c.PeriCtct),
                        BimeCtct: bime,
                        Concepto: null,
                        Capital: 0,
                        Recargo: 0
                    };
                }
                groups[key].Capital += parseFloat(c.Capital) || 0;
                groups[key].Recargo += parseFloat(c.Recargo) || 0;
                if (!groups[key].Concepto) {
                    groups[key].Concepto = c.Concepto;
                }
            });
        } else if (debt && debt.length > 0) {
            debt.forEach(row => {
                const bime = parseInt(row.BimeCtct || 0);
                if (bime <= 0) return;

                // Excluir conceptos de gastos, comisiones y honorarios de apremio (comienzan con 9)
                const conceptCode = (row.CodiConc || '').toString().trim();
                if (conceptCode.startsWith('9')) return;

                const key = `${row.PeriCtct}-${row.BimeCtct}`;
                if (!groups[key]) {
                    groups[key] = {
                        PeriCtct: parseInt(row.PeriCtct),
                        BimeCtct: bime,
                        Concepto: null,
                        Capital: 0,
                        Recargo: 0,
                        Expenses: 0
                    };
                }

                const debe = parseFloat(row.DebeCtct || 0);
                const mov = parseInt(row.MoviCtct || 0);

                if (interestConcepts.includes(conceptCode) || (mov > 1 && !expenseConcepts.includes(conceptCode))) {
                    groups[key].Recargo += debe;
                } else if (expenseConcepts.includes(conceptCode)) {
                    groups[key].Expenses += debe;
                } else if (mov === 1 || !conceptCode) {
                    groups[key].Capital += debe;
                    if (!groups[key].Concepto) {
                        groups[key].Concepto = row.DetaCtct || row.Concepto;
                    }
                }
            });
        } else {
            return [];
        }

        return Object.values(groups).map(g => ({
            PeriCtct: g.PeriCtct,
            BimeCtct: g.BimeCtct,
            Concepto: g.Concepto || 'Cuota Apremio',
            Capital: g.Capital,
            Recargo: g.Recargo + (g.Expenses || 0),
            Total: g.Capital + g.Recargo + (g.Expenses || 0)
        })).sort((a, b) => {
            if (a.PeriCtct !== b.PeriCtct) return a.PeriCtct - b.PeriCtct;
            return a.BimeCtct - b.BimeCtct;
        });
    };

    // Helper para obtener cabeceras con Token
    const getAuthHeaders = () => {
        const token = localStorage.getItem('nomade_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const res = await fetch(`${API_BASE}/apremio-individual/statuses`, {
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) setStatuses(data);
                }
            } catch (err) { console.error("Error fetching statuses:", err); }
        };
        fetchStatuses();
    }, []);

    useEffect(() => {
        if (viewMode === 'search') {
            fetchResults(currentPage);
        }
    }, [currentPage, statusFilter, viewMode]);

    const fetchResults = async (page = 1) => {
        if (viewMode !== 'search') return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/apremio-individual/search?q=${searchTerm}&status=${statusFilter}&page=${page}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Error en la búsqueda');
            const response = await res.json();
            setSearchResults(response.data || []);
            setTotalResults(response.total || 0);
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        setCurrentPage(1);
        fetchResults(1);
    };

    const fetchDetail = async (numeApre) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/apremio-individual/detail/${numeApre}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Error al obtener detalle');
            const data = await res.json();
            setDetail(data);
            setViewMode('detail');
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    const handleExportXLS = async () => {
        setExporting(true);
        try {
            const res = await fetch(`${API_BASE}/apremio-individual/export?q=${searchTerm}&status=${statusFilter}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Error al exportar');
            const data = await res.json();
            
            if (!data || data.length === 0) {
                alert("No hay datos para exportar");
                return;
            }

            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(';')];
            
            for (const row of data) {
                const values = headers.map(header => {
                    const val = row[header];
                    return `"${(val || '').toString().replace(/"/g, '""')}"`;
                });
                csvRows.push(values.join(';'));
            }
            
            const csvContent = "\uFEFF" + csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Exportacion_Apremios_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert("Error al exportar: " + err.message);
        } finally {
            setExporting(false);
        }
    };

    const generatePDF = (data) => {
        const { apremio, instances, debt, payments = [] } = data;
        const doc = new jsPDF();
        
        const activeInstallments = processClaimedInstallments(data);
        const totalCapital = activeInstallments.reduce((acc, curr) => acc + curr.Capital, 0);
        const totalInteres = activeInstallments.reduce((acc, curr) => acc + curr.Recargo, 0);
        const gastosAdm = (totalCapital + totalInteres) * 0.05;
        const totalGeneral = totalCapital + totalInteres + gastosAdm;

        doc.setFontSize(22);
        doc.setTextColor(0, 90, 141);
        doc.setFont('helvetica', 'bold');
        doc.text('RECAUDACIÓN', 15, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont('helvetica', 'normal');
        doc.text('Municipalidad de Guaymallén', 15, 26);
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE ESTADOS BOLETA DE DEUDA', 110, 20, { align: 'left' });
        doc.setFontSize(10);
        doc.text(`BOLETA N°: ${apremio.NumeApre || '-'}`, 110, 26);
        doc.text(`CAMPAÑA N°: ${apremio.PeriBole || '-'}`, 110, 31);
        doc.setFont('helvetica', 'normal');
        doc.text(`Guaymallén, ${new Date().toLocaleDateString()}`, 110, 36);

        doc.setFillColor(163, 163, 163);
        doc.rect(15, 42, 180, 8, 'F');
        doc.setTextColor(255);
        doc.setFont('helvetica', 'bold');
        doc.text(`Expediente: ${apremio.AutoApre || '-'}`, 190, 47, { align: 'right' });

        autoTable(doc, {
            startY: 55,
            head: [['Cuenta', 'Agente (Recaudador)', 'Alta', 'Exp. Apremio', 'Estado', 'Juzgado']],
            body: [[apremio.CuenCtct, `${apremio.CodiReca} - ${apremio.Recaudador}`, formatDate(apremio.FealApre), apremio.NumeApre, apremio.EstadoDeta || 'Activo', apremio.JuzgInap]],
            headStyles: { fillColor: [204, 230, 244], textColor: [0, 74, 117] },
            styles: { fontSize: 8, cellPadding: 2 }
        });

        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text('Titulares', 15, doc.lastAutoTable.finalY + 10);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 13,
            head: [['Nombre', 'CUIT / CUIL']],
            body: [[apremio.TituApre, apremio.CucuPers]],
            headStyles: { fillColor: [204, 230, 244], textColor: [0, 74, 117] },
            styles: { fontSize: 8 }
        });

        const periodos = Array.from(new Set(activeInstallments.map(d => d.PeriCtct)))
            .sort((a, b) => a - b)
            .map(year => {
                const cuotas = Array.from(new Set(
                    activeInstallments
                        .filter(d => d.PeriCtct === year)
                        .map(d => d.BimeCtct)
                )).sort((a, b) => a - b);
                return `${year}: ${cuotas.join(', ')};`;
            }).join(' ');
        
        doc.setFontSize(12);
        let yPos = doc.lastAutoTable.finalY + 10;
        doc.text('Períodos Reclamados', 15, yPos);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const splitPeriodos = doc.splitTextToSize(periodos, 180);
        yPos += 5; // Bajamos un poco para el contenido de los periodos
        doc.text(splitPeriodos, 15, yPos);
        
        // Calculamos cuánto bajó el texto
        const textHeight = splitPeriodos.length * 4;
        yPos += textHeight + 10;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Datos del Boleto Asociado', 15, yPos);
        
        const boleto = data.boleto;
        const estadoBoleto = boleto ? (boleto.FechaPago ? `PAGADO (${formatDate(boleto.FechaPago)})` : (boleto.EstaBole || 'EMITIDO')) : 'N/A';

        autoTable(doc, {
            startY: yPos + 5,
            head: [['Año/Nro Boleto', 'Estado Boleto', 'Fecha Pago', 'Acta/Boleto Pago', 'Usuario Pago']],
            body: [[
                boleto ? `${boleto.PeriBole} / ${boleto.NumeBole}` : 'N/A',
                estadoBoleto,
                boleto && boleto.FechaPago ? formatDate(boleto.FechaPago) : '-',
                boleto && boleto.ActaPago ? boleto.ActaPago : '-',
                boleto && boleto.UsuarioPago ? boleto.UsuarioPago : '-'
            ]],
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
            styles: { fontSize: 8 }
        });

        yPos = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Cuotas reclamadas', 15, yPos);

        autoTable(doc, {
            startY: yPos + 5,
            head: [['Periodo', 'Cuota', 'Conceptos', 'Capital', 'Recargo', 'Total']],
            body: [
                ...activeInstallments.map(d => [
                    d.PeriCtct, 
                    d.BimeCtct, 
                    d.Concepto, 
                    formatCurrency(d.Capital),
                    formatCurrency(d.Recargo),
                    formatCurrency(d.Total)
                ]),
                [{ content: 'Totales', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [243, 244, 246] } }, 
                 { content: formatCurrency(totalCapital), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
                 { content: formatCurrency(totalInteres), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
                 { content: formatCurrency(totalCapital + totalInteres), styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } }]
            ],
            headStyles: { fillColor: [204, 230, 244], textColor: [0, 74, 117] },
            styles: { fontSize: 7 }
        });

        if (data.paymentPlan) {
            yPos = doc.lastAutoTable.finalY + 15;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`Detalle de Plan de Pago (Facilidad N° ${data.paymentPlan.header.CodiFapa})`, 15, yPos);
            
            autoTable(doc, {
                startY: yPos + 5,
                head: [['Cuota', 'Honorarios', 'Gastos', 'Interés', 'Estado Plan']],
                body: data.paymentPlan.installments.map(cuota => [
                    cuota.CuotDefa,
                    formatCurrency(cuota.CoadFaap),
                    formatCurrency(cuota.ApleFaap),
                    formatCurrency(cuota.IcomFaap),
                    data.paymentPlan.header.EstaFapa
                ]),
                headStyles: { fillColor: [209, 250, 229], textColor: [6, 78, 59] },
                styles: { fontSize: 7 }
            });
        }

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Concepto', 'Capital', 'Interés', 'Total']],
            body: [
                ['Total Reclamado', formatCurrency(totalCapital), formatCurrency(totalInteres), formatCurrency(totalCapital + totalInteres)],
                ['Gastos Administrativos (5%)', '-', '-', formatCurrency(gastosAdm)],
                [{ content: 'TOTAL GENERAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [0, 90, 141], textColor: [255, 255, 255] } },
                { content: formatCurrency(totalGeneral), styles: { fontStyle: 'bold', fillColor: [0, 90, 141], textColor: [255, 255, 255] } }]
            ],
            headStyles: { fillColor: [204, 230, 244], textColor: [0, 74, 117] },
            styles: { fontSize: 8 }
        });

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text('Instancias Boleta de deuda', 15, doc.lastAutoTable.finalY + 10);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 13,
            head: [['Fecha Alta', 'N°', 'Instancia Judicial', 'Agente', 'Juzgado']],
            body: instances.map(inst => [formatDate(inst.FechInap), inst.CodiInju, inst.DetaInju, apremio.OficialJusticia, inst.JuzgInap]),
            headStyles: { fillColor: [204, 230, 244], textColor: [0, 74, 117] },
            styles: { fontSize: 7 }
        });

        if (payments && payments.length > 0) {
            doc.addPage();
            doc.setFontSize(22);
            doc.setTextColor(0, 90, 141);
            doc.setFont('helvetica', 'bold');
            doc.text('RECAUDACIÓN', 15, 20);
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('DETALLE DE PAGOS / HONORARIOS', 110, 20, { align: 'left' });
            
            autoTable(doc, {
                startY: 30,
                head: [['Fecha Pago', 'Cuota', 'N° Boleto', 'Estado', 'Honorarios', 'Gastos', 'Interés', 'Usuario']],
                body: payments.map(p => [
                    formatDate(p.FeacPaap), 
                    p.NumePaag, 
                    p.NumeBole, 
                    p.EstaPaap, 
                    formatCurrency(p.CoadPaap), 
                    formatCurrency(p.AplePaap),
                    formatCurrency(p.IcomPaap),
                    p.AltaUsua
                ]),
                headStyles: { fillColor: [204, 230, 244], textColor: [0, 74, 117] },
                styles: { fontSize: 7 }
            });
        }

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        }

        const pdfBlob = doc.output('bloburl');
        setPreviewPdf(pdfBlob);
    };

    const handleQuickDownload = async (e, numeApre) => {
        e.stopPropagation();
        setDownloadingId(numeApre);
        try {
            const res = await fetch(`${API_BASE}/apremio-individual/detail/${numeApre}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            generatePDF(data);
        } catch (err) { alert("Error al generar PDF: " + err.message); } finally { setDownloadingId(null); }
    };

    const mainStyles = {
        container: { width: '100%', padding: '1rem', boxSizing: 'border-box', color: '#f1f5f9', minHeight: '100vh', overflowY: 'auto' },
        card: { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.7)' },
        tableContainer: { overflowX: 'auto', backgroundColor: '#020617', borderRadius: '0.75rem', border: '1px solid #1e293b', marginBottom: '1rem' },
        table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', whiteSpace: 'nowrap' },
        th: { padding: '0.75rem 1rem', borderBottom: '2px solid #1e293b', color: '#64748b', fontWeight: 'bold', textAlign: 'left', position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 10 },
        td: { padding: '0.6rem 1rem', borderBottom: '1px solid #1e293b', color: '#cbd5e1' },
        input: { width: '100%', backgroundColor: '#020617', border: '1px solid #1e293b', padding: '1rem 3.5rem', borderRadius: '0.75rem', color: 'white', fontSize: '1.1rem', outline: 'none' },
        select: { backgroundColor: '#020617', border: '1px solid #1e293b', padding: '0.6rem 1rem', borderRadius: '0.5rem', color: 'white', outline: 'none', cursor: 'pointer' },
        btnSearch: { padding: '0.6rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer' },
        btnExport: { padding: '0.6rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' },
        pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #1e293b' },
        btnPage: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' },
        statusBadge: (code) => ({
            padding: '0.2rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.65rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            backgroundColor: code === 99 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            color: code === 99 ? '#10b981' : '#3b82f6',
            border: `1px solid ${code === 99 ? '#10b981' : '#3b82f6'}`
        })
    };

    const totalPages = Math.ceil(totalResults / LIMIT);

    if (viewMode === 'detail' && detail) {
        const payments = detail.payments || [];
        const activeInstallments = processClaimedInstallments(detail);
        const hasApredeta = detail.claimedInstallments && detail.claimedInstallments.length > 0;
        const dynamicCapital = activeInstallments.reduce((acc, curr) => acc + curr.Capital, 0);
        const dynamicRecargo = activeInstallments.reduce((acc, curr) => acc + curr.Recargo, 0);
        const dynamicTotal = dynamicCapital + dynamicRecargo;

        return (
            <div style={mainStyles.container}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <button onClick={() => setViewMode('search')} style={{ background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <ArrowLeft size={18} /> Volver
                    </button>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button 
                            onClick={() => setSelectedGrNumeApre(detail.apremio.NumeApre)} 
                            style={{ 
                                backgroundColor: '#7c4dff', 
                                color: 'white', 
                                padding: '0.6rem 1.5rem', 
                                borderRadius: '0.5rem', 
                                border: 'none', 
                                fontWeight: 'bold', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6533ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7c4dff'}
                        >
                            <Scale size={18} /> Ver Estructura GR
                        </button>
                        <button onClick={() => generatePDF(detail)} style={{ backgroundColor: '#10b981', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Download size={18} /> Descargar PDF Oficial
                        </button>
                    </div>
                </div>
                <div style={mainStyles.card}>
                    <div style={{ padding: '2rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Detalle de Apremio #{detail.apremio.NumeApre}</h2>
                            <p style={{ color: '#64748b', margin: '0.5rem 0' }}>{detail.apremio.TituApre} | {detail.apremio.CuenCtct}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(dynamicTotal)}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TOTAL RECLAMADO (MAPEADO)</div>
                        </div>
                    </div>
                    <div style={{ padding: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>OFICINA</label><div style={{ fontSize: '0.9rem' }}>{detail.apremio.CodiOfic}</div></div>
                            <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>CUENTA</label><div style={{ fontSize: '0.9rem' }}>{detail.apremio.CuenCtct}</div></div>
                            <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>JUZGADO / INST.</label><div style={{ fontSize: '0.9rem' }}>{detail.apremio.JuzgInap} (Cod: {detail.apremio.CodiInju})</div></div>
                            <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>TITULAR</label><div style={{ fontSize: '0.9rem' }}>{detail.apremio.TituApre}</div></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>RECAUDADOR</label><div style={{ fontSize: '0.9rem' }}>{detail.apremio.RecaudadorDeta || `Cod: ${detail.apremio.CodiReca}`}</div></div>
                            <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>OFICIAL DE JUSTICIA</label><div style={{ fontSize: '0.9rem' }}>{detail.apremio.OficialJusticiaDeta || `Cod: ${detail.apremio.CodiOfju}`}</div></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.7rem', color: '#94a3b8' }}>DESGLOSE DE DEUDA RECLAMADA (MAPEADO)</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Capital Original:</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{formatCurrency(dynamicCapital)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Recargos / Intereses:</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{formatCurrency(dynamicRecargo)}</span>
                                </div>
                                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Total Reclamado:</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(dynamicTotal)}</span>
                                </div>
                                <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #1e293b', paddingTop: '0.5rem' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Cabecera Apremio:</span>
                                        <span>Cap: {formatCurrency(detail.apremio.CapiApre)} | Rec: {formatCurrency(detail.apremio.RecaApre)}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.7rem', color: '#94a3b8' }}>OBSERVACIONES DEL APREMIO</h4>
                                <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#cbd5e1', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                                    {detail.apremio.ObseApre || 'Sin observaciones registradas.'}
                                </div>
                            </div>
                        </div>

                        {/* SECCIÓN: INSTANCIAS DE BOLETA DE DEUDA (instapre) */}
                        <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', color: '#3b82f6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <History size={18} /> Instancias de la Boleta de Deuda (instapre)
                            </h3>
                            <div style={mainStyles.tableContainer}>
                                <table style={mainStyles.table}>
                                    <thead>
                                        <tr>
                                            <th style={mainStyles.th}>Fecha Alta</th>
                                            <th style={mainStyles.th}>Fecha Instancia</th>
                                            <th style={mainStyles.th}>Cód.</th>
                                            <th style={mainStyles.th}>Instancia Judicial</th>
                                            <th style={mainStyles.th}>Recaudador (Cód)</th>
                                            <th style={mainStyles.th}>Of. Justicia (Cód)</th>
                                            <th style={mainStyles.th}>Juzgado</th>
                                            <th style={mainStyles.th}>Medida Cautelar</th>
                                            <th style={mainStyles.th}>Kms 1</th>
                                            <th style={mainStyles.th}>Kms 2</th>
                                            <th style={mainStyles.th}>Zona</th>
                                            <th style={mainStyles.th}>Observaciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.instances && detail.instances.length > 0 ? (
                                            detail.instances.map((inst, i) => (
                                                <tr key={i}>
                                                    <td style={mainStyles.td}>{formatDate(inst.FealInap)}</td>
                                                    <td style={mainStyles.td}>{formatDate(inst.FechInap)}</td>
                                                    <td style={mainStyles.td}>{inst.CodiInju}</td>
                                                    <td style={{ ...mainStyles.td, fontWeight: 'bold' }}>{inst.DetaInju || 'Sin descripción'}</td>
                                                    <td style={mainStyles.td}>{inst.CodiReca}</td>
                                                    <td style={mainStyles.td}>{inst.CodiOfju}</td>
                                                    <td style={mainStyles.td}>{inst.JuzgInap || '-'}</td>
                                                    <td style={mainStyles.td}>{inst.MecaInap || '-'}</td>
                                                    <td style={mainStyles.td}>{inst.Kmt1Inap != null ? parseFloat(inst.Kmt1Inap).toFixed(2) : '-'}</td>
                                                    <td style={mainStyles.td}>{inst.Kmt2Inap != null ? parseFloat(inst.Kmt2Inap).toFixed(2) : '-'}</td>
                                                    <td style={mainStyles.td}>{inst.ZonaMoap || '-'}</td>
                                                    <td style={{ ...mainStyles.td, whiteSpace: 'normal', minWidth: '200px' }}>{inst.ObseInap || '-'}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="12" style={{ ...mainStyles.td, textAlign: 'center', color: '#64748b' }}>No hay instancias registradas para este apremio.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* SECCIÓN: CUOTAS RECLAMADAS */}
                        <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', color: '#3b82f6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Table size={18} /> Cuotas Reclamadas ({hasApredeta ? 'Origen: Histórico apredeta' : 'Origen: Reconstruido de ctacte'})
                            </h3>
                            <div style={mainStyles.tableContainer}>
                                <table style={mainStyles.table}>
                                    <thead>
                                        <tr>
                                            <th style={mainStyles.th}>Año</th>
                                            <th style={mainStyles.th}>Cuota</th>
                                            <th style={mainStyles.th}>Concepto</th>
                                            <th style={mainStyles.th}>Capital</th>
                                            <th style={mainStyles.th}>Recargo</th>
                                            <th style={mainStyles.th}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeInstallments && activeInstallments.length > 0 ? (
                                            activeInstallments.map((cuota, i) => (
                                                <tr key={i}>
                                                    <td style={mainStyles.td}>{cuota.PeriCtct}</td>
                                                    <td style={mainStyles.td}>{cuota.BimeCtct}</td>
                                                    <td style={mainStyles.td}>{cuota.Concepto || 'Cuota Apremio'}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(cuota.Capital)}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(cuota.Recargo)}</td>
                                                    <td style={{ ...mainStyles.td, fontWeight: 'bold' }}>{formatCurrency(cuota.Total)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan="6" style={{ ...mainStyles.td, textAlign: 'center', color: '#64748b' }}>No hay registros de cuotas para este apremio.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* NUEVA SECCIÓN: BOLETO ASOCIADO */}
                        <div style={{ padding: '1rem', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '0.75rem', border: '1px solid rgba(37, 99, 235, 0.2)', marginBottom: '2rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={16} /> BOLETO ORIGEN ASOCIADO
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>AÑO / NÚMERO</label><div style={{ fontSize: '0.85rem' }}>{detail.boleto ? `${detail.boleto.PeriBole} / ${detail.boleto.NumeBole}` : 'N/A'}</div></div>
                                <div>
                                    <label style={{ fontSize: '0.6rem', color: '#64748b' }}>ESTADO</label>
                                    <div style={{ fontSize: '0.85rem', color: detail.boleto?.FechaPago ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                                        {detail.boleto ? (detail.boleto.FechaPago ? 'PAGADO' : 'PENDIENTE') : 'N/A'}
                                    </div>
                                </div>
                                {detail.boleto?.FechaPago && (
                                    <>
                                        <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>FECHA PAGO</label><div style={{ fontSize: '0.85rem' }}>{formatDate(detail.boleto.FechaPago)}</div></div>
                                        <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>USUARIO COBRO</label><div style={{ fontSize: '0.85rem' }}>{detail.boleto.UsuarioPago}</div></div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* SECCIÓN: PLAN DE PAGO (FACILIDAD) */}
                        {detail.paymentPlan && (
                            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '2rem' }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <History size={16} /> PLAN DE PAGO ASOCIADO (FACILIDAD)
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>NRO PLAN</label><div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{detail.paymentPlan.header.CodiFapa}</div></div>
                                    <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>FECHA ALTA</label><div style={{ fontSize: '0.85rem' }}>{formatDate(detail.paymentPlan.header.FealFapa)}</div></div>
                                    <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>ESTADO</label><div style={{ fontSize: '0.85rem' }}>{detail.paymentPlan.header.EstaFapa}</div></div>
                                    <div><label style={{ fontSize: '0.6rem', color: '#64748b' }}>TOTAL PLAN</label><div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(detail.paymentPlan.header.TotaFapa)}</div></div>
                                </div>
                                
                                <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>DETALLE DE CUOTAS (HONORARIOS / GASTOS EN EL PLAN)</label>
                                <div style={mainStyles.tableContainer}>
                                    <table style={mainStyles.table}>
                                        <thead>
                                            <tr>
                                                <th style={mainStyles.th}>Cuota</th>
                                                <th style={mainStyles.th}>Honorarios</th>
                                                <th style={mainStyles.th}>Gastos</th>
                                                <th style={mainStyles.th}>Interés</th>
                                                <th style={mainStyles.th}>Total Cuota</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.paymentPlan.installments.map((cuota, i) => (
                                                <tr key={i}>
                                                    <td style={mainStyles.td}>{cuota.CuotDefa}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(cuota.CoadFaap)}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(cuota.ApleFaap)}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(cuota.IcomFaap)}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(parseFloat(cuota.CoadFaap) + parseFloat(cuota.ApleFaap) + parseFloat(cuota.IcomFaap))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {payments.length > 0 && (
                            <div style={{ marginTop: '2rem' }}>
                                <h3 style={{ fontSize: '1rem', color: '#10b981', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <DollarSign size={18} /> Pagos de Apremio / Honorarios
                                </h3>
                                <div style={mainStyles.tableContainer}>
                                    <table style={mainStyles.table}>
                                        <thead>
                                            <tr>
                                                <th style={mainStyles.th}>Fecha</th>
                                                <th style={mainStyles.th}>Cuota</th>
                                                <th style={mainStyles.th}>Boleto</th>
                                                <th style={mainStyles.th}>Estado</th>
                                                <th style={mainStyles.th}>Honorarios</th>
                                                <th style={mainStyles.th}>Gastos</th>
                                                <th style={mainStyles.th}>Interés</th>
                                                <th style={mainStyles.th}>Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.map((p, i) => (
                                                <tr key={i}>
                                                    <td style={mainStyles.td}>{formatDate(p.FeacPaap)}</td>
                                                    <td style={mainStyles.td}>{p.NumePaag}</td>
                                                    <td style={mainStyles.td}>{p.NumeBole}</td>
                                                    <td style={mainStyles.td}>
                                                        <span style={{ 
                                                            padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem',
                                                            backgroundColor: p.EstaPaap === 'Pagado' ? '#10b98120' : '#3b82f620',
                                                            color: p.EstaPaap === 'Pagado' ? '#10b981' : '#3b82f6',
                                                            border: `1px solid ${p.EstaPaap === 'Pagado' ? '#10b98140' : '#3b82f640'}`
                                                        }}>{p.EstaPaap}</span>
                                                    </td>
                                                    <td style={mainStyles.td}>{formatCurrency(p.CoadPaap)}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(p.AplePaap)}</td>
                                                    <td style={mainStyles.td}>{formatCurrency(p.IcomPaap)}</td>
                                                    <td style={mainStyles.td}>{p.AltaUsua}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={mainStyles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Módulo de Apremios</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button style={{ ...mainStyles.btnSearch, backgroundColor: '#1e293b' }} onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCurrentPage(1); }}>Limpiar</button>
                    <button style={mainStyles.btnExport} onClick={handleExportXLS} disabled={exporting}>
                        {exporting ? <Loader2 className="spin" size={18} /> : <Table size={18} />}
                        {exporting ? 'Generando...' : 'Exportar Excel (XLS)'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <form onSubmit={handleSearch} style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={24} />
                    <input style={mainStyles.input} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Busque por Número, Cuenta o Nombre..." />
                    <button type="submit" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', ...mainStyles.btnSearch }}>Buscar</button>
                </form>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '250px' }}>
                    <Filter size={20} color="#64748b" />
                    <select 
                        style={{ ...mainStyles.select, flex: 1 }} 
                        value={statusFilter} 
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="all">Todos los Estados</option>
                        {Array.isArray(statuses) && statuses.map(s => (
                            <option key={s.CodiEsap} value={s.CodiEsap}>{s.DetaEsap}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && !searchResults.length && <div style={{ textAlign: 'center', padding: '2rem', color: '#3b82f6' }}>Cargando registros...</div>}

            {searchResults.length > 0 && (
                <div style={{ paddingBottom: '3rem' }}>
                    <div style={mainStyles.tableContainer}>
                        <table style={mainStyles.table}>
                            <thead>
                                <tr>
                                    <th style={mainStyles.th}>PDF</th>
                                    <th style={mainStyles.th}>GR</th>
                                    <th style={mainStyles.th}>NUME</th>
                                    <th style={mainStyles.th}>CUENTA</th>
                                    <th style={mainStyles.th}>TITULAR</th>
                                    <th style={mainStyles.th}>ESTADO</th>
                                    <th style={mainStyles.th}>JUZGADO</th>
                                    <th style={mainStyles.th}>OFICIAL</th>
                                    <th style={mainStyles.th}>PERIODOS</th>
                                    <th style={mainStyles.th}>TOTAL</th>
                                    <th style={mainStyles.th}>ACC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchResults.map((a) => (
                                    <tr key={a.NumeApre} style={{ cursor: 'pointer' }} onClick={() => fetchDetail(a.NumeApre)} className="hover-row">
                                        <td style={mainStyles.td}>
                                            <button 
                                                onClick={(e) => handleQuickDownload(e, a.NumeApre)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: downloadingId === a.NumeApre ? '#3b82f6' : '#ef4444' }}
                                                title="Descargar PDF Oficial"
                                            >
                                                {downloadingId === a.NumeApre ? <Loader2 size={18} className="spin" /> : <FileDown size={18} />}
                                            </button>
                                        </td>
                                        <td style={mainStyles.td}>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedGrNumeApre(a.NumeApre);
                                                }}
                                                title="Ver Estructura GR"
                                                style={{
                                                    background: 'rgba(124, 77, 255, 0.15)',
                                                    border: '1px solid rgba(124, 77, 255, 0.3)',
                                                    color: '#cbd5e1',
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
                                                    e.currentTarget.style.color = '#cbd5e1';
                                                }}
                                            >
                                                <Scale size={12} /> GR
                                            </button>
                                        </td>
                                        <td style={{ ...mainStyles.td, fontWeight: 'bold' }}>{a.NumeApre}</td>
                                        <td style={mainStyles.td}>{a.CuenCtct}</td>
                                        <td style={mainStyles.td}>{a.TituApre}</td>
                                        <td style={mainStyles.td}>
                                            <span style={mainStyles.statusBadge(a.EstaApre)}>
                                                {a.EstadoDeta || `Estado ${a.EstaApre}`}
                                            </span>
                                        </td>
                                        <td style={mainStyles.td}>{a.JuzgInap}</td>
                                        <td style={mainStyles.td}>{a.OficialJusticia || '-'}</td>
                                        <td style={{ ...mainStyles.td, fontSize: '0.65rem', color: '#94a3b8', maxWidth: '150px' }}>
                                            {a.PeriodosSummary || '-'}
                                        </td>
                                        <td style={{ ...mainStyles.td, fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(a.TotaApre)}</td>
                                        <td style={mainStyles.td}><ArrowRight size={14} color="#3b82f6" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={mainStyles.pagination}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ ...mainStyles.btnPage, opacity: currentPage === 1 ? 0.5 : 1 }}><ChevronLeft size={18} /> Anterior</button>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Página <span style={{ color: 'white', fontWeight: 'bold' }}>{currentPage}</span> de <span style={{ color: 'white', fontWeight: 'bold' }}>{totalPages}</span> ({totalResults} registros)</span>
                        <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ ...mainStyles.btnPage, opacity: currentPage >= totalPages ? 0.5 : 1 }}>Siguiente <ChevronRight size={18} /></button>
                    </div>
                </div>
            )}

            <style>{`
                .hover-row:hover { background-color: rgba(37, 99, 235, 0.1); }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }
                .pdf-modal {
                    width: 90%;
                    height: 90%;
                    background: white;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .pdf-header {
                    padding: 1rem;
                    background: #1e293b;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
            `}</style>

            {/* PDF Preview Modal */}
            {previewPdf && (
                <div className="modal-overlay" onClick={() => setPreviewPdf(null)}>
                    <div className="pdf-modal" onClick={e => e.stopPropagation()}>
                        <div className="pdf-header">
                            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={20} /> Previsualización de Reporte
                            </h3>
                            <button 
                                onClick={() => setPreviewPdf(null)}
                                style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
                            >&times;</button>
                        </div>
                        <iframe 
                            src={previewPdf} 
                            style={{ width: '100%', height: '100%', border: 'none' }} 
                            title="PDF Preview"
                        />
                    </div>
                </div>
            )}
            {selectedGrNumeApre && (
                <PostgresCedulaModal 
                    numeApre={selectedGrNumeApre} 
                    onClose={() => setSelectedGrNumeApre(null)} 
                />
            )}
        </div>
    );
};

export default ApremioIndividualReport;
