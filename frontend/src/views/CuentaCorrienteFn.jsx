import React, { useState, useEffect } from 'react';
import { Search, Info, CheckCircle2, AlertCircle, Calendar, Filter, X, FileText, Download, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import API_BASE_URL from '../config';

const CuentaCorrienteFn = ({ user }) => {
    const isMunic = user?.rol === 'municipalidad' || user?.rol === 'usuario';
    const [offices, setOffices] = useState([]);
    const [selectedOffice, setSelectedOffice] = useState('1'); // Default Inmueble
    const [account, setAccount] = useState('');
    const [onlyDebt, setOnlyDebt] = useState(false);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [legacyData, setLegacyData] = useState([]);
    const [postgresData, setPostgresData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [showSqlMariaModal, setShowSqlMariaModal] = useState(false);
    const [showSqlPgModal, setShowSqlPgModal] = useState(false);
    const [error, setError] = useState(null);
    const [postgresError, setPostgresError] = useState(null);
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualContent, setManualContent] = useState('');
    const [showFormulaModal, setShowFormulaModal] = useState(false);

    const [showSubtotals, setShowSubtotals] = useState(false);
    const [isGrouped, setIsGrouped] = useState(false);
    const [leftWidth, setLeftWidth] = useState(50); // Set initial width to 50%
    const [isResizing, setIsResizing] = useState(false);
    const [searchBy, setSearchBy] = useState('person'); // 'account' or 'person'
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [showQuotaDetail, setShowQuotaDetail] = useState(false);
    const [foundOffices, setFoundOffices] = useState([]);
    const [isResolvingOffices, setIsResolvingOffices] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [personAccounts, setPersonAccounts] = useState([]);
    const [selectedAccountFilter, setSelectedAccountFilter] = useState('all');

    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');

    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
    const [showTicketsModal, setShowTicketsModal] = useState(false);
    const [ticketHistory, setTicketHistory] = useState([]);
    const [isFetchingTickets, setIsFetchingTickets] = useState(false);
    const [selectedPeriodForTickets, setSelectedPeriodForTickets] = useState(null);
    const [selectedRowForAudit, setSelectedRowForAudit] = useState(null);

    const [showPgTicketsModal, setShowPgTicketsModal] = useState(false);
    const [pgTicketHistory, setPgTicketHistory] = useState([]);
    const [isFetchingPgTickets, setIsFetchingPgTickets] = useState(false);

    const formatCurrency = (val) => {
        return parseFloat(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getEffectiveDate = (row) => {
        const debe = parseFloat(row.DebeCtct || 0);
        const isPayment = (debe === 0);
        const dateField = isPayment ? (row.FechaPago || row.FechaPagoReal || row.FechPago || row.FeveCtct) : row.FeveCtct;
        if (!dateField || dateField === '0001-01-01' || dateField.startsWith('0001-01-01')) {
            return row.FeveCtct ? new Date(row.FeveCtct) : new Date(0);
        }
        return new Date(dateField);
    };

    const getAuthHeaders = () => {
        const token = localStorage.getItem('nomade_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    // Person search autocomplete
    const [personSearchText, setPersonSearchText] = useState('');
    const [personSearchResults, setPersonSearchResults] = useState([]);
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);
    const [isSearchingPerson, setIsSearchingPerson] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = (e.clientX / window.innerWidth) * 100;
            if (newWidth > 20 && newWidth < 80) { // Limit resizing between 20% and 80%
                setLeftWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/ctacte-fn/offices`, {
            headers: getAuthHeaders()
        })
            .then(res => res.json())
            .then(data => setOffices(data))
            .catch(err => console.error('Error fetching offices:', err));
    }, []);

    // Resolve offices for account
    useEffect(() => {
        if (!account || account.length < 1) {
            setFoundOffices([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsResolvingOffices(true);
            try {
                const res = await fetch(`${API_BASE_URL}/api/ctacte/resolve-account/${account}?searchType=${searchBy}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();

                if (Array.isArray(data)) {
                    setFoundOffices(data);
                    if (data.length > 0) {
                        const currentOffInNewList = data.find(o => o.id.toString() === selectedOffice);
                        if (!selectedOffice || !currentOffInNewList) {
                            setSelectedOffice(data[0].id.toString());
                        }
                    }
                } else {
                    setFoundOffices([]);
                }
            } catch (err) {
                console.error('Error resolving offices:', err);
            } finally {
                setIsResolvingOffices(false);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [account, searchBy]);

    // Debounced person search
    useEffect(() => {
        if (searchBy !== 'person' || personSearchText.length < 2) {
            setPersonSearchResults([]);
            setShowPersonDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingPerson(true);
            try {
                const res = await fetch(`${API_BASE_URL}/api/ctacte/search-person?q=${encodeURIComponent(personSearchText)}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                setPersonSearchResults(data);
                setShowPersonDropdown(data.length > 0);
            } catch (err) {
                console.error('Error searching person:', err);
            } finally {
                setIsSearchingPerson(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [personSearchText, searchBy]);

    const quickSearchAccount = (accNum) => {
        setSelectedAccountFilter(accNum.toString().trim());
        // We use a small timeout to ensure state has updated before search
        setTimeout(() => {
            const btn = document.getElementById('btn-main-search');
            if (btn) btn.click();
        }, 100);
    };

    const handleSelectPerson = (person) => {
        // Set the percod as the account (used for person search)
        setAccount(person.percod.toString());
        setPersonSearchText(`${person.pernom} (${person.cuit || person.percod})`);
        setShowPersonDropdown(false);

        // Auto-resolve offices from the person's accounts
        if (person.accounts && person.accounts.length > 0) {
            setPersonAccounts(person.accounts);
            const uniqueOffices = [];
            const seen = new Set();
            person.accounts.forEach(a => {
                if (!seen.has(a.officeId)) {
                    seen.add(a.officeId);
                    uniqueOffices.push({ id: a.officeId, name: a.officeName });
                }
            });
            setFoundOffices(uniqueOffices);
            if (uniqueOffices.length > 0) {
                setSelectedOffice(uniqueOffices[0].id.toString());
            }
            setSelectedAccountFilter('all');
        } else {
            setPersonAccounts([]);
            setSelectedAccountFilter('all');
        }
    };

    const renderRows = () => {
        if (!legacyData || legacyData.length === 0) return null;

        let displayData = legacyData;

        // If grouped, aggregate by period/bime just like Postgres
        if (isGrouped && !showQuotaDetail) {
            const groupedMap = legacyData.reduce((acc, row) => {
                let p = parseInt(row.PeriCtct);
                let b = parseInt(row.BimeCtct);

                if (onlyDebt && p <= 2018) {
                    p = 2018;
                    b = 99;
                }

                const key = `${p}-${b}`;
                const isPaid = (row.NumeAcpa && row.NumeAcpa != '0') || (row.numeAcpa && row.numeAcpa != '0');

                if (!acc[key]) {
                    acc[key] = {
                        ...row,
                        PeriCtct: p,
                        BimeCtct: b,
                        FeveCtct: (p === 2018 && b === 99) ? '2018-12-31' : row.FeveCtct,
                        DebeCtct: 0,
                        RecaCtct: 0,
                        CredCtct: 0,
                        TotaCtct: 0,
                        paidCount: 0,
                        totalCount: 0,
                        hasApremio: false,
                        hasPlan: false,
                        NumeApre: null,
                        CodiFapa: null,
                        DetaCtct: (p === 2018 && b === 99) ? 'Deuda Atrasada (<= 2018)' : 'Varios Conceptos'
                    };
                }
                acc[key].DebeCtct += parseFloat(row.DebeCtct || 0);
                acc[key].RecaCtct += parseFloat(row.RecaCtct || 0);
                acc[key].CredCtct += parseFloat(row.CredCtct || 0);
                acc[key].TotaCtct += parseFloat(row.TotaCtct || 0);
                acc[key].totalCount += 1;
                if (isPaid) acc[key].paidCount += 1;

                if (row.NumeBole) {
                    acc[key].NumeBole = row.NumeBole;
                    acc[key].PeriBole = row.PeriBole || row.periBole;
                }
                if (row.hasApremio) {
                    acc[key].hasApremio = true;
                    acc[key].NumeApre = row.NumeApre || row.numeapre || acc[key].NumeApre;
                }
                if (row.hasPlan) {
                    acc[key].hasPlan = true;
                    acc[key].CodiFapa = row.CodiFapa || row.codifapa || acc[key].CodiFapa;
                }

                return acc;
            }, {});

            // Filter out Apremio/Plan icons for groups that are already fully paid
            displayData = Object.values(groupedMap).map(group => {
                const isActuallyPaid = group.TotaCtct <= 0.10 && group.totalCount > 0;
                if (isActuallyPaid) {
                    return { ...group, hasApremio: false, hasPlan: false };
                }

                // Determine label if not 2018/99
                if (group.PeriCtct !== 2018 || group.BimeCtct !== 99) {
                    if (group.paidCount > 0 && group.paidCount < group.totalCount) {
                        group.DetaCtct = `Pagos Parciales (${group.paidCount}/${group.totalCount})`;
                        // We keep the NumeAcpa if it exists, but the pill logic will handle the balance
                    } else if (group.paidCount === group.totalCount) {
                        group.DetaCtct = 'Pagado Total';
                        group.NumeAcpa = group.NumeAcpa || 'Varios';
                    } else {
                        group.DetaCtct = 'Pendiente Total';
                        group.NumeAcpa = '0';
                    }
                }

                // IMPORTANT: If there is still a balance, ensure it doesn't just say "Pagado"
                if (group.TotaCtct > 0.10 && group.paidCount > 0) {
                    group.isPartial = true;
                }

                return group;
            });

            // Ensure consistent sort after grouping: Year DESC, Bime ASC
            displayData.sort((a, b) => {
                if (b.PeriCtct !== a.PeriCtct) return b.PeriCtct - a.PeriCtct;
                return a.BimeCtct - b.BimeCtct;
            });
        } else {
            // Sort details deterministically
            displayData = [...legacyData].sort((a, b) => {
                if (b.PeriCtct !== a.PeriCtct) return b.PeriCtct - a.PeriCtct;
                if (a.BimeCtct !== b.BimeCtct) return a.BimeCtct - b.BimeCtct;
                
                // Primero el Debe (débito) y después el Haber (créditos/pagos)
                const aDebe = parseFloat(a.DebeCtct || 0);
                const bDebe = parseFloat(b.DebeCtct || 0);
                const isADebit = aDebe > 0;
                const isBDebit = bDebe > 0;
                if (isADebit && !isBDebit) return -1;
                if (!isADebit && isBDebit) return 1;
                
                const dateA = getEffectiveDate(a).getTime();
                const dateB = getEffectiveDate(b).getTime();
                if (dateA !== dateB) return dateA - dateB;
                
                if (aDebe !== bDebe) return bDebe - aDebe;
                
                const aCred = parseFloat(a.CredCtct || 0);
                const bCred = parseFloat(b.CredCtct || 0);
                if (aCred !== bCred) return bCred - aCred;
                
                const aDeta = (a.DetaCtct || a.DetailName || '').toString();
                const bDeta = (b.DetaCtct || b.DetailName || '').toString();
                return aDeta.localeCompare(bDeta);
            });
        }

        // Calculate chronological running balance from bottom to top
        let runningBal = 0;
        for (let i = displayData.length - 1; i >= 0; i--) {
            const row = displayData[i];
            const rowDebe = parseFloat(row.DebeCtct || 0);
            const rowReca = isMunic ? 0 : parseFloat(row.RecaCtct || 0);
            const rowCred = parseFloat(row.CredCtct || 0);
            const rowHaber = isMunic ? (rowDebe === 0 ? rowCred : Math.min(rowDebe, rowCred)) : rowCred;
            
            runningBal += rowDebe + rowReca - rowHaber;
            row.cumulativeBalance = runningBal;
        }

        const rows = [];
        let currentPeriod = null;
        let currentBime = null;
        let periodTotals = { debe: 0, reca: 0, haber: 0, total: 0 };

        displayData.forEach((row, idx) => {
            if (showSubtotals && (currentPeriod !== row.PeriCtct || currentBime !== row.BimeCtct)) {
                if (currentPeriod !== null) {
                    rows.push(<SubtotalRow key={`sub-${currentPeriod}-${currentBime}`} period={currentPeriod} bime={currentBime} totals={periodTotals} />);
                }
                currentPeriod = row.PeriCtct;
                currentBime = row.BimeCtct;
                periodTotals = { debe: 0, reca: 0, haber: 0, total: 0 };
            }

            const rowDebe = parseFloat(row.DebeCtct || 0);
            const rowCred = parseFloat(row.CredCtct || 0);
            
            periodTotals.debe += rowDebe;
            periodTotals.reca += (isMunic ? 0 : parseFloat(row.RecaCtct || 0));
            periodTotals.haber += (isMunic ? (rowDebe === 0 ? rowCred : Math.min(rowDebe, rowCred)) : rowCred);
            periodTotals.total += (isMunic ? (rowDebe - (rowDebe === 0 ? rowCred : Math.min(rowDebe, rowCred))) : parseFloat(row.TotaCtct || 0));

            // Use DataRow normally, which now handles aggregated "Varios Conceptos" objects
            rows.push(<DataRow key={idx} row={row} />);
        });

        // Add last subtotal
        if (showSubtotals && currentPeriod !== null) {
            rows.push(<SubtotalRow key={`sub-last`} period={currentPeriod} bime={currentBime} totals={periodTotals} />);
        }

        return rows;
    };

    const openManual = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/docs/migration-logic`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (response.ok) {
                setManualContent(data.content);
                setShowManualModal(true);
            }
        } catch (err) {
            console.error('Error fetching manual:', err);
        }
    };

    const fetchTicketHistory = async (row) => {
        setSelectedRowForAudit(row);
        setIsFetchingTickets(true);
        setSelectedPeriodForTickets(`${row.PeriCtct}/${row.BimeCtct}`);
        setTicketHistory([]);
        setShowTicketsModal(true);

        try {
            // Find the correct office for this row (might be different if searching by person)
            const offId = row.officeId || selectedOffice;
            const res = await fetch(`${API_BASE_URL}/api/ctacte-fn/tickets/${offId}/${row.CuenCtct}/${row.PeriCtct}/${row.BimeCtct}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                setTicketHistory(data);
            }
        } catch (err) {
            console.error('Error fetching ticket history:', err);
        } finally {
            setIsFetchingTickets(false);
        }
    };

    const fetchPgTicketHistory = async (row) => {
        setSelectedRowForAudit(row);
        setIsFetchingPgTickets(true);
        setSelectedPeriodForTickets(`${row.PeriCtct}/${row.BimeCtct}`);
        setPgTicketHistory([]);
        setShowPgTicketsModal(true);

        try {
            const accId = row.CuenCtct || account;
            const res = await fetch(`${API_BASE_URL}/api/ctacte-fn/pg-tickets/${accId}/${row.PeriCtct}/${row.BimeCtct}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                setPgTicketHistory(data);
            } else {
                console.error("Error fetching PG tickets:", data.error);
            }
        } catch (err) {
            console.error("Error fetching PG tickets:", err);
        } finally {
            setIsFetchingPgTickets(false);
        }
    };

    const generateAuditPDF = (row, history) => {
        if (!row) return;
        const doc = new jsPDF();
        
        // Normalización de campos (MariaDB a veces devuelve minúsculas o mayúsculas)
        const peri = row.PeriCtct || row.perictct || 'N/A';
        const bime = row.BimeCtct || row.bimectct || 'N/A';
        const cuen = row.CuenCtct || row.cuenctct || account || 'N/A';
        const debe = row.DebeCtct || row.debectct || 0;
        const cred = row.CredCtct || row.credctct || 0;
        const tota = row.TotaCtct || row.totactct || (debe - cred);

        const offId = row.officeId || row.codiofic || selectedOffice;
        const officeName = offices.find(o => o.id == offId)?.name || 'Oficina ' + offId;

        // Header
        doc.setFontSize(18);
        doc.setTextColor(37, 99, 235);
        doc.text('Informe de Auditoría de Cuenta Corriente', 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

        // Account Box
        doc.setDrawColor(200);
        doc.setFillColor(245, 247, 250);
        doc.rect(14, 35, 182, 30, 'F');
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL PADRÓN', 18, 42);
        doc.setFont('helvetica', 'normal');
        doc.text(`Padrón: ${cuen} | Oficina: ${officeName}`, 18, 50);
        
        const ownerName = selectedPerson?.text || (legacyData.length > 0 ? legacyData[0].RazoPers : 'Titular No Identificado');
        doc.text(`Titular: ${ownerName}`, 18, 58);

        // Period Box
        doc.setFont('helvetica', 'bold');
        doc.text('CUOTA SELECCIONADA', 14, 75);
        doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${peri} | Cuota/Bime: ${bime}`, 14, 82);
        doc.text(`Deuda Registrada en CtaCte: $${formatCurrency(debe)}`, 14, 89);
        doc.text(`Créditos Registrados en CtaCte: $${formatCurrency(cred)}`, 14, 96);
        if (tota > 0) doc.setTextColor(200, 0, 0); else doc.setTextColor(0, 0, 0);
        doc.text(`Saldo Final en CtaCte: $${formatCurrency(tota)}`, 14, 103);
        doc.setTextColor(0, 0, 0);

        // Tickets History Table
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text('HISTORIAL DE BOLETOS EMITIDOS (MARIADB)', 14, 115);
        
        const tableData = history.map(t => [
            t.NumeBole,
            new Date(t.AltaFeho).toLocaleDateString(),
            t.UserName || t.CodiUsua,
            t.EstaBole,
            `$${formatCurrency(t.CapiBole)}`,
            `$${formatCurrency(t.RecaBole)}`,
            `$${formatCurrency(t.TotaBole)}`
        ]);

        autoTable(doc, {
            startY: 120,
            head: [['Boleto', 'Fecha', 'Usuario', 'Estado', 'Capital', 'Recargos', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] },
            styles: { fontSize: 8 }
        });

        // Discrepancy Analysis
        const lastPos = doc.lastAutoTable.finalY + 15;
        doc.setFont('helvetica', 'bold');
        doc.text('ANÁLISIS DE AUDITORÍA', 14, lastPos);
        doc.setFont('helvetica', 'normal');
        
        let analysis = '';
        if (history.length > 1) {
            const first = history[0];
            const last = history[history.length - 1];
            if (parseFloat(first.CapiBole) !== parseFloat(last.CapiBole)) {
                const diff = Math.abs(parseFloat(first.CapiBole) - parseFloat(last.CapiBole));
                analysis = `Se detectó una re-emisión con cambio de capital por el usuario ${last.UserName || last.CodiUsua}. ` +
                           `La diferencia de $${formatCurrency(diff)} entre el capital original ($${formatCurrency(first.CapiBole)}) ` +
                           `y el capital actualizado ($${formatCurrency(last.CapiBole)}) no fue impactada como ajuste en la CtaCte.`;
            } else {
                analysis = 'Se detectaron múltiples boletos pero el capital se mantiene consistente.';
            }
        } else if (history.length === 1) {
            analysis = 'Solo existe un boleto emitido para este período.';
        } else {
            analysis = 'No se encontraron boletos físicos en la tabla de comprobantes para este período.';
        }

        const splitText = doc.splitTextToSize(analysis, 180);
        doc.text(splitText, 14, lastPos + 7);

        // PostgreSQL State (NEW)
        const pgRow = postgresData.find(p => 
            (p.PeriCtct || p.perictct) == peri && 
            (p.BimeCtct || p.bimectct) == bime
        );

        const pgPos = lastPos + 35;
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.5);
        doc.line(14, pgPos - 5, 196, pgPos - 5);
        
        doc.setFont('helvetica', 'bold');
        doc.text('ESTADO EN NUEVO SISTEMA (POSTGRESQL)', 14, pgPos);
        doc.setFont('helvetica', 'normal');
        
        if (pgRow) {
            const pgDebe = pgRow.DebeCtct || pgRow.debectct || 0;
            const pgCred = pgRow.CredCtct || pgRow.credctct || 0;
            const pgTota = pgRow.TotaCtct || pgRow.totactct || (pgDebe - pgCred);
            
            doc.text(`Deuda en Postgres: $${formatCurrency(pgDebe)}`, 14, pgPos + 7);
            doc.text(`Pagos en Postgres: $${formatCurrency(pgCred)}`, 14, pgPos + 14);
            if (pgTota > 0) doc.setTextColor(200, 0, 0); else doc.setTextColor(0, 150, 0);
            doc.text(`Saldo Final en Postgres: $${formatCurrency(pgTota)}`, 14, pgPos + 21);
            doc.setTextColor(0, 0, 0);
            
            if (pgTota === 0 && tota > 0) {
                doc.setFont('helvetica', 'bold');
                doc.text('✓ CORREGIDO: El saldo fue saneado durante la migración.', 14, pgPos + 30);
            }
        } else {
            doc.text('No se encontró este período migrado en la base de datos PostgreSQL.', 14, pgPos + 7);
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Este documento es un reporte técnico de auditoría generado automáticamente por el Sistema de Migración.', 14, 285);

        doc.save(`Auditoria_${row.CuenCtct}_${row.PeriCtct}_${row.BimeCtct}.pdf`);
    };

    const DataRow = ({ row }) => (
        <tr>
            <td style={{ whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{row.PeriCtct}/{row.BimeCtct}</span>
                    <span title={row.DetaCtct || row.TipoTributo || ''} style={{ cursor: 'help', opacity: 0.6 }}>
                        <Info size={14} />
                    </span>
                </div>
                {row.NumeBole && row.NumeBole !== '0' && row.NumeBole !== 0 && (
                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                        #{row.NumeBole}{row.PeriBole && row.PeriBole !== '0000' && `/${row.PeriBole}`}
                    </div>
                )}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>
                {(() => {
                    const debe = parseFloat(row.DebeCtct || 0);
                    const displayDateVal = (debe === 0 && row.FechaPago && row.FechaPago !== '0001-01-01' && !row.FechaPago.startsWith('0001-01-01')) ? row.FechaPago : row.FeveCtct;
                    return displayDateVal ? new Date(displayDateVal).toLocaleDateString() : '-';
                })()}
            </td>
            <td style={{ fontSize: '0.8rem', opacity: 0.9 }}>{row.DetaCtct}</td>
            <td style={{ textAlign: 'center' }}>
                {row.hasApremio ? (
                    <span title={`Apremio: ${row.NumeApre || 'Sí'}`} style={{ cursor: 'help' }}>
                        <CheckCircle2 size={16} color="#ef4444" />
                    </span>
                ) : '-'}
            </td>
            <td style={{ textAlign: 'center' }}>
                {row.hasPlan ? (
                    <span title={`Plan: ${row.CodiFapa || 'Sí'}`} style={{ cursor: 'help' }}>
                        <CheckCircle2 size={16} color="#3b82f6" />
                    </span>
                ) : '-'}
            </td>
            <td style={{ color: '#ef4444' }}>${formatCurrency(row.DebeCtct)}</td>
            {!isMunic && <td style={{ color: '#f59e0b' }}>${formatCurrency(row.RecaCtct)}</td>}
            <td style={{ color: '#10b981' }}>
                ${formatCurrency(isMunic ? (parseFloat(row.DebeCtct || 0) === 0 ? parseFloat(row.CredCtct || 0) : Math.min(parseFloat(row.DebeCtct || 0), parseFloat(row.CredCtct || 0))) : row.CredCtct)}
            </td>
            <td>
                {(() => {
                    const hasBalance = parseFloat(row.TotaCtct || 0) > 0.10;
                    const hasPayment = (row.FechPago || (row.NumeAcpa && row.NumeAcpa != '0'));

                    let statusClass = 'D';
                    let statusText = 'Deuda';

                    if (!hasBalance) {
                        statusClass = 'P';
                        statusText = 'Pagado';
                    } else if (hasPayment) {
                        statusClass = 'W'; // Warning/Partial
                        statusText = 'Parcial';
                    }

                    return (
                        <div 
                            className={`status-pill ${statusClass}`} 
                            style={{ cursor: 'pointer' }}
                            onClick={() => fetchTicketHistory(row)}
                            title="Ver historial de boletos emitidos"
                        >
                            {statusText}
                        </div>
                    );
                })()}
                {(row.FechPago || (row.NumeAcpa && row.NumeAcpa != '0')) && (
                    <div style={{ fontSize: '0.7rem', marginTop: '2px', opacity: 0.7 }}>
                        {row.NumeAcpa && row.NumeAcpa != '0' && <span>Ref: {row.NumeAcpa}</span>}
                        {row.FechPago && (
                            <div style={{ fontWeight: 'bold', color: '#10b981' }}>F. Pago: {new Date(row.FechPago).toLocaleDateString()}</div>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );

    const SubtotalRow = ({ period, bime, totals }) => (
        <tr className="subtotal-row">
            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                Subtotal {period}/{bime}:
            </td>
            <td style={{ color: '#ef4444', fontWeight: 'bold' }}>${formatCurrency(totals.debe)}</td>
            {!isMunic && <td style={{ color: '#f59e0b', fontWeight: 'bold' }}>${formatCurrency(totals.reca)}</td>}
            <td style={{ color: '#10b981', fontWeight: 'bold' }}>${formatCurrency(totals.haber)}</td>
            <td></td>
        </tr>
    );

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!account) return;

        setLoading(true);
        setError(null);
        setPostgresError(null);
        setLegacyData([]);
        setPostgresData([]);

        // Determine which account(s) to search
        const finalAccountToSearch = (searchBy === 'person' && selectedAccountFilter !== 'all')
            ? selectedAccountFilter
            : account;

        // 1. Fetch PostgreSQL Data (New System)
        let pgData = [];
        const isDetailRequested = !isGrouped;
        try {
            let pgUrl = `${API_BASE_URL}/api/ctacte-fn/new/search?officeId=${selectedOffice}&account=${finalAccountToSearch}&searchType=${selectedAccountFilter !== 'all' ? 'account' : searchBy}&percod=${account}&toDate=${toDate}&onlyDebt=${onlyDebt}&showQuotaDetail=${isDetailRequested}&filterYear=${filterYear}&filterMonth=${filterMonth}`;
            const pgRes = await fetch(pgUrl, {
                headers: getAuthHeaders()
            });
            const pgResult = await pgRes.json();

            if (!pgRes.ok) {
                setPostgresError(pgResult.error || 'Error searching postgres data');
            } else {
                pgData = pgResult;
                setPostgresData(pgData);
            }
        } catch (err) {
            console.error('Postgres fetch error:', err);
            setPostgresError('No se pudo conectar a PostgreSQL.');
        }

        // 2. Determine accounts and THEIR OFFICES for MariaDB
        let queryGroups = [];
        if (searchBy === 'person' && selectedAccountFilter === 'all' && pgData.length > 0) {
            const groups = pgData.reduce((acc, r) => {
                const offId = r.officeId || 1;
                if (!acc[offId]) acc[offId] = new Set();
                acc[offId].add(r.CuenCtct);
                return acc;
            }, {});

            queryGroups = Object.entries(groups).map(([offId, set]) => ({
                office: offId,
                accounts: Array.from(set)
            }));
        } else {
            queryGroups = [{ office: selectedOffice || 1, accounts: [finalAccountToSearch] }];
        }

        // 3. Fetch MariaDB Data (Legacy System) - independent, non-blocking
        try {
            let allLegacyData = [];
            for (const group of queryGroups) {
                let legacyUrl = `${API_BASE_URL}/api/ctacte-fn/legacy/search?officeId=${group.office}&type=optimized&onlyDebt=${onlyDebt}&toDate=${toDate}&filterYear=${filterYear}&filterMonth=${filterMonth}&showQuotaDetail=${isDetailRequested}`;
                group.accounts.forEach(acc => {
                    legacyUrl += `&account=${acc}`;
                });

                const legacyRes = await fetch(legacyUrl, {
                    headers: getAuthHeaders()
                });
                const legacyDataRes = await legacyRes.json();

                if (legacyRes.ok) {
                    allLegacyData = [...allLegacyData, ...legacyDataRes];
                } else {
                    console.error(`Error in MariaDB office ${group.office}:`, legacyDataRes.error);
                }
            }
            setLegacyData(allLegacyData);
        } catch (err) {
            console.error('MariaDB fetch error:', err);
            setError('⚠️ MariaDB no disponible. Mostrando solo datos de PostgreSQL.');
        }

        setLoading(false);
    };

    const handleGeneratePDF = () => {
        try {
            const doc = new jsPDF('p', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const mainColor = [37, 99, 235]; // #2563eb
            const legacyColor = [16, 185, 129]; // #10b981

            // Helper to apply grouping and subtotal logic for PDF
            const prepareExportData = (srcData, isLegacy) => {
                let displayData = srcData;

                // Grouping Logic
                if (isGrouped && !showQuotaDetail) {
                    const grouped = srcData.reduce((acc, row) => {
                        let p = parseInt(row.PeriCtct);
                        let b = parseInt(row.BimeCtct);

                        if (isLegacy && onlyDebt && p <= 2018) {
                            p = 2018;
                            b = 99;
                        }

                        const key = `${p}-${b}`;
                        const isPaid = (row.NumeAcpa && row.NumeAcpa != '0') || (row.numeacpa && row.numeacpa != '0');

                        if (!acc[key]) {
                            acc[key] = {
                                ...row,
                                PeriCtct: p,
                                BimeCtct: b,
                                DebeCtct: 0, RecaCtct: 0, CredCtct: 0, TotaCtct: 0,
                                paidCount: 0, totalCount: 0,
                                DetaCtct: (isLegacy && p === 2018 && b === 99) ? 'Deuda Atrasada (<= 2018)' : 'Varios Conceptos',
                                DetailName: 'Varios Conceptos' // Postgres specific
                            };
                            if (isLegacy && p === 2018 && b === 99) {
                                acc[key].FeveCtct = '2018-12-31';
                            }
                        }
                        acc[key].DebeCtct += parseFloat(row.DebeCtct || row.debectct || 0);
                        acc[key].RecaCtct += parseFloat(row.RecaCtct || row.recactct || 0);
                        acc[key].CredCtct += parseFloat(row.CredCtct || row.credctct || 0);
                        acc[key].TotaCtct += parseFloat(row.TotaCtct || row.totactct || 0);
                        acc[key].totalCount += 1;
                        if (isPaid) acc[key].paidCount += 1;

                        // Label Updates
                        if (!isLegacy || p !== 2018 || b !== 99) {
                            let statusLabel = 'Pendiente Total';
                            if (acc[key].paidCount > 0 && acc[key].paidCount < acc[key].totalCount) statusLabel = `Pagos Parciales (${acc[key].paidCount}/${acc[key].totalCount})`;
                            else if (acc[key].paidCount === acc[key].totalCount) statusLabel = 'Pagado Total';

                            acc[key].DetaCtct = statusLabel;
                            acc[key].DetailName = statusLabel;
                        }
                        return acc;
                    }, {});
                } else if (!isLegacy) {
                    // Split PostgreSQL paid rows for PDF consistency (only if it has both debit and credit)
                    const splitData = [];
                    srcData.forEach(row => {
                        const rowDebe = parseFloat(row.DebeCtct || 0);
                        const rowCred = parseFloat(row.CredCtct || 0);
                        if (rowDebe > 0.01 && rowCred > 0.01) {
                            splitData.push({
                                ...row,
                                CredCtct: 0,
                                TotaCtct: rowDebe,
                                NumeAcpa: null,
                                FechaPago: null
                            });
                            splitData.push({
                                ...row,
                                DebeCtct: 0,
                                RecaCtct: 0,
                                TotaCtct: 0
                            });
                        } else {
                            splitData.push(row);
                        }
                    });
                    displayData = splitData;
                }

                // Sort details deterministically if not grouped
                if (!isGrouped || showQuotaDetail) {
                    displayData = [...displayData].sort((a, b) => {
                        if (b.PeriCtct !== a.PeriCtct) return b.PeriCtct - a.PeriCtct;
                        if (a.BimeCtct !== b.BimeCtct) return a.BimeCtct - b.BimeCtct;
                        
                        // Primero el Debe (débito) y después el Haber (créditos/pagos)
                        const aDebe = parseFloat(a.DebeCtct || 0);
                        const bDebe = parseFloat(b.DebeCtct || 0);
                        const isADebit = aDebe > 0;
                        const isBDebit = bDebe > 0;
                        if (isADebit && !isBDebit) return -1;
                        if (!isADebit && isBDebit) return 1;
                        
                        const dateA = getEffectiveDate(a).getTime();
                        const dateB = getEffectiveDate(b).getTime();
                        if (dateA !== dateB) return dateA - dateB;
                        
                        if (aDebe !== bDebe) return bDebe - aDebe;
                        
                        const aCred = parseFloat(a.CredCtct || 0);
                        const bCred = parseFloat(b.CredCtct || 0);
                        if (aCred !== bCred) return bCred - aCred;
                        
                        const aDeta = (a.DetaCtct || a.DetailName || '').toString();
                        const bDeta = (b.DetaCtct || b.DetailName || '').toString();
                        return aDeta.localeCompare(bDeta);
                    });
                }

                // Calculate chronological running balance from bottom to top
                let runningBal = 0;
                for (let i = displayData.length - 1; i >= 0; i--) {
                    const row = displayData[i];
                    const pDebe = parseFloat(row.DebeCtct || 0);
                    const pReca = isMunic ? 0 : parseFloat(row.RecaCtct || 0);
                    const pHaberOriginal = parseFloat(row.CredCtct || 0);
                    const pHaber = isMunic ? (pDebe === 0 ? pHaberOriginal : Math.min(pDebe, pHaberOriginal)) : pHaberOriginal;
                    
                    runningBal += pDebe + pReca - pHaber;
                    row.cumulativeBalance = runningBal;
                }

                // Subtotal Logic injected as fake rows
                const exportRows = [];
                let currentPeriod = null;
                let currentBime = null;
                let subTotals = { debe: 0, reca: 0, haber: 0, total: 0 };
                let grandTotals = { debe: 0, reca: 0, haber: 0, total: 0 };

                displayData.forEach((row) => {
                    if (showSubtotals && (currentPeriod !== row.PeriCtct || currentBime !== row.BimeCtct)) {
                        if (currentPeriod !== null) {
                            exportRows.push({
                                isSubtotal: true,
                                label: `Subtotal ${currentPeriod}/${currentBime}:`,
                                DebeCtct: subTotals.debe,
                                RecaCtct: subTotals.reca,
                                CredCtct: subTotals.haber,
                                TotaCtct: subTotals.total
                            });
                        }
                        currentPeriod = row.PeriCtct;
                        currentBime = row.BimeCtct;
                        subTotals = { debe: 0, reca: 0, haber: 0, total: 0 };
                    }

                    const pDebe = parseFloat(row.DebeCtct || 0);
                    const pReca = parseFloat(row.RecaCtct || 0);
                    const pHaberOriginal = parseFloat(row.CredCtct || 0);
                    
                    const pHaber = isMunic ? (pDebe === 0 ? pHaberOriginal : Math.min(pDebe, pHaberOriginal)) : pHaberOriginal;
                    const pTotal = isMunic ? (pDebe - (pDebe === 0 ? pHaberOriginal : Math.min(pDebe, pHaberOriginal))) : parseFloat(row.TotaCtct || 0);

                    subTotals.debe += pDebe;
                    subTotals.reca += (isMunic ? 0 : pReca);
                    subTotals.haber += pHaber;
                    subTotals.total += pTotal;

                    grandTotals.debe += pDebe;
                    grandTotals.reca += (isMunic ? 0 : pReca);
                    grandTotals.haber += pHaber;
                    grandTotals.total += pTotal;

                     const exportRow = {
                         ...row,
                         CredCtct: pHaber,
                         TotaCtct: row.cumulativeBalance
                     };
                     if (pDebe === 0 && row.FechaPago && row.FechaPago !== '0001-01-01' && !row.FechaPago.startsWith('0001-01-01')) {
                         exportRow.FeveCtct = row.FechaPago;
                     }
                     exportRows.push(exportRow);
                });

                if (showSubtotals && currentPeriod !== null) {
                    exportRows.push({
                        isSubtotal: true,
                        label: `Subtotal ${currentPeriod}/${currentBime}:`,
                        DebeCtct: subTotals.debe,
                        RecaCtct: subTotals.reca,
                        CredCtct: subTotals.haber,
                        TotaCtct: subTotals.total
                    });
                }

                // Add Grand Total row at the very end
                if (displayData.length > 0) {
                    exportRows.push({
                        isGrandTotal: true,
                        label: `TOTAL GENERAL:`,
                        DebeCtct: grandTotals.debe,
                        RecaCtct: grandTotals.reca,
                        CredCtct: grandTotals.haber,
                        TotaCtct: grandTotals.total
                    });
                }

                return exportRows;
            };

            const preparedLegacyData = prepareExportData(legacyData, true);
            const preparedPostgresData = prepareExportData(postgresData, false);

            // Header
            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text('INFORME DE AUDITORÍA DE MIGRACIÓN', pageWidth / 2, 40, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Fecha de Reporte: ${new Date().toLocaleString()}`, 40, 65);

            const ownerName = postgresData[0]?.OwnerName || postgresData[0]?.ownername || legacyData[0]?.DetaCtct?.split(' - ')[0] || 'N/A';
            const percod = postgresData[0]?.PersonId || postgresData[0]?.personid || 'N/A';
            const cuit = postgresData[0]?.CUIT || '--';
            const cta = [...new Set(postgresData.map(d => d.CuenCtct || d.cuenctct))].filter(Boolean).join(', ') || account;
            const offName = (Array.isArray(foundOffices) ? foundOffices.find(o => o.id.toString() === selectedOffice)?.name : null) || selectedOffice;

            doc.setFontSize(11);
            doc.setTextColor(40);
            doc.text(`Titular: ${ownerName} (${percod})`, 40, 85);
            doc.text(`CUIT: ${cuit} | Cuenta: ${cta} | Oficina: ${offName}`, 40, 100);

            if (postgresData[0]?.Nomenclatura) {
                doc.text(`Nomenclatura: ${postgresData[0].Nomenclatura}`, 40, 115);
            } else if (postgresData[0]?.Pabellon) {
                doc.text(`Ubicación: Pab: ${postgresData[0].Pabellon.trim()} Nicho: ${postgresData[0].Nicho?.trim() || ''}`, 40, 115);
            }

            let currentY = 135;

            // LEGACY TABLE (only if data available)
            if (preparedLegacyData.length > 0) {
                doc.setFontSize(13);
                doc.setTextColor(legacyColor[0], legacyColor[1], legacyColor[2]);
                doc.text('SISTEMA ORIGINAL (MARIADB)', 40, currentY);
                currentY += 10;

                const legacyRows = preparedLegacyData.map(r =>
                    r.isGrandTotal ? [
                        { content: r.label, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [50, 50, 50], textColor: [255, 255, 255], fontSize: 9 } },
                        { content: `$${r.DebeCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: [255, 200, 200] } },
                        ...(isMunic ? [] : [{ content: `$${r.RecaCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: [253, 230, 138] } }]),
                        { content: `$${r.CredCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: [167, 243, 208] } }
                    ] : r.isSubtotal ? [
                        { content: r.label, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', textColor: legacyColor } },
                        { content: `$${r.DebeCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [239, 68, 68] } },
                        ...(isMunic ? [] : [{ content: `$${r.RecaCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [245, 158, 11] } }]),
                        { content: `$${r.CredCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [16, 185, 129] } }
                    ] : [
                        `${r.PeriCtct || ''}/${r.BimeCtct || ''}`,
                        r.FeveCtct ? new Date(r.FeveCtct).toLocaleDateString() : '-',
                        (r.DetaCtct || '').substring(0, 35),
                        `$${parseFloat(r.DebeCtct || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        ...(isMunic ? [] : [`$${parseFloat(r.RecaCtct || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]),
                        `$${parseFloat(r.CredCtct || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [isMunic 
                        ? ['Pe/C', 'Vencimiento', 'Detalle', 'Debe', 'Haber']
                        : ['Pe/C', 'Vencimiento', 'Detalle', 'Debe', 'Recargo', 'Haber']],
                    body: legacyRows,
                    theme: 'grid',
                    headStyles: { fillColor: legacyColor, fontSize: 8 },
                    styles: { fontSize: 7, cellPadding: 3 },
                    margin: { left: 40, right: 40 }
                });

                // Add margins so it doesn't overlap with Postgres table
                currentY = (doc.lastAutoTable?.finalY || currentY) + 35;
            } else {
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text('MariaDB: Sin datos disponibles (servidor no accesible)', 40, currentY);
                currentY += 35;
            }

            // POSTGRES TABLE (only if data available)
            if (preparedPostgresData.length > 0) {
                doc.setFontSize(13);
                doc.setTextColor(mainColor[0], mainColor[1], mainColor[2]);
                doc.text('SISTEMA NUEVO (POSTGRESQL)', 40, currentY);
                currentY += 10;

                const pgRows = preparedPostgresData.map(r =>
                    r.isGrandTotal ? [
                        { content: r.label, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [50, 50, 50], textColor: [255, 255, 255], fontSize: 9 } },
                        { content: `$${r.DebeCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: [255, 200, 200] } },
                        ...(isMunic ? [] : [{ content: `$${r.RecaCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: [253, 230, 138] } }]),
                        { content: `$${r.CredCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [50, 50, 50], textColor: [167, 243, 208] } }
                    ] : r.isSubtotal ? [
                        { content: r.label, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', textColor: mainColor } },
                        { content: `$${r.DebeCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [239, 68, 68] } },
                        ...(isMunic ? [] : [{ content: `$${r.RecaCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [245, 158, 11] } }]),
                        { content: `$${r.CredCtct.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [16, 185, 129] } }
                    ] : [
                        `${r.PeriCtct || ''}/${r.BimeCtct || ''}`,
                        r.FeveCtct ? new Date(r.FeveCtct).toLocaleDateString() : '-',
                        `${r.DetaCtct || r.DetailName || r.TipoTributo || ''}`,
                        `$${parseFloat(r.DebeCtct || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                        ...(isMunic ? [] : [`$${parseFloat(r.RecaCtct || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]),
                        `$${parseFloat(r.CredCtct || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [isMunic 
                        ? ['Pe/C', 'Vencimiento', 'Concepto', 'Debe', 'Haber']
                        : ['Pe/C', 'Vencimiento', 'Concepto', 'Debe', 'Interés', 'Haber']],
                    body: pgRows,
                    theme: 'grid',
                    headStyles: { fillColor: mainColor, fontSize: 8 },
                    styles: { fontSize: 7, cellPadding: 3 },
                    margin: { left: 40, right: 40 }
                });
            } else {
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text('PostgreSQL: Sin datos disponibles', 40, currentY);
            }

            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
            setShowPdfModal(true);
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Error al generar el PDF: ' + err.message);
        }
    };

    const renderPostgresRows = () => {
        if (!postgresData || postgresData.length === 0) return null;

        let displayData = postgresData;

        // If grouped, aggregate by period/bime
        if (isGrouped && !showQuotaDetail) {
            const groupedMap = postgresData.reduce((acc, row) => {
                const key = `${row.PeriCtct}-${row.BimeCtct}`;
                const isPaid = (row.NumeAcpa && row.NumeAcpa != '0') || (row.numeacpa && row.numeacpa != '0');

                if (!acc[key]) {
                    acc[key] = {
                        ...row,
                        DebeCtct: 0,
                        RecaCtct: 0,
                        CredCtct: 0,
                        TotaCtct: 0,
                        paidCount: 0,
                        totalCount: 0,
                        DetailRef: 'Multiple',
                        DetailName: 'Varios Conceptos'
                    };
                }
                acc[key].DebeCtct += parseFloat(row.DebeCtct || 0);
                acc[key].RecaCtct += parseFloat(row.RecaCtct || 0);
                acc[key].CredCtct += parseFloat(row.CredCtct || 0);
                acc[key].TotaCtct += parseFloat(row.TotaCtct || 0);
                acc[key].totalCount += 1;
                if (isPaid) acc[key].paidCount += 1;

                if (row.hasApremio) {
                    acc[key].hasApremio = true;
                    acc[key].NumeApre = row.NumeApre || row.numeapre || acc[key].NumeApre;
                }
                if (row.hasPlan) {
                    acc[key].hasPlan = true;
                    acc[key].plnpgocod = row.plnpgocod || acc[key].plnpgocod;
                }

                return acc;
            }, {});

            // Filter out Apremio/Plan icons for groups that are already fully paid
            displayData = Object.values(groupedMap).map(group => {
                const isActuallyPaid = group.TotaCtct <= 0.10 && group.totalCount > 0;
                if (isActuallyPaid) {
                    return { ...group, hasApremio: false, hasPlan: false };
                }

                // Determine label: if some paid and some not -> Pagos Parciales
                if (group.paidCount > 0 && group.paidCount < group.totalCount) {
                    group.DetailName = `Pagos Parciales (${group.paidCount}/${group.totalCount})`;
                } else if (group.paidCount === group.totalCount) {
                    group.DetailName = 'Pagado Total';
                } else {
                    group.DetailName = 'Pendiente Total';
                    group.NumeAcpa = '0';
                }
                return group;
            });

            // Ensure consistent sort after grouping: Year DESC, Bime ASC
            displayData.sort((a, b) => {
                if (b.PeriCtct !== a.PeriCtct) return b.PeriCtct - a.PeriCtct;
                return a.BimeCtct - b.BimeCtct;
            });
        } else {
            // If not grouped, split paid rows into a debit row and a credit (payment) row (only if both are positive)
            const splitData = [];
            postgresData.forEach(row => {
                const rowDebe = parseFloat(row.DebeCtct || 0);
                const rowCred = parseFloat(row.CredCtct || 0);

                if (rowDebe > 0.01 && rowCred > 0.01) {
                    splitData.push({
                        ...row,
                        CredCtct: 0,
                        TotaCtct: rowDebe,
                        NumeAcpa: null,
                        FechaPago: null
                    });
                    splitData.push({
                        ...row,
                        DebeCtct: 0,
                        RecaCtct: 0,
                        TotaCtct: 0
                    });
                } else {
                    splitData.push(row);
                }
            });
            displayData = splitData.sort((a, b) => {
                if (b.PeriCtct !== a.PeriCtct) return b.PeriCtct - a.PeriCtct;
                if (a.BimeCtct !== b.BimeCtct) return a.BimeCtct - b.BimeCtct;
                
                // Primero el Debe (débito) y después el Haber (créditos/pagos)
                const aDebe = parseFloat(a.DebeCtct || 0);
                const bDebe = parseFloat(b.DebeCtct || 0);
                const isADebit = aDebe > 0;
                const isBDebit = bDebe > 0;
                if (isADebit && !isBDebit) return -1;
                if (!isADebit && isBDebit) return 1;
                
                const dateA = getEffectiveDate(a).getTime();
                const dateB = getEffectiveDate(b).getTime();
                if (dateA !== dateB) return dateA - dateB;
                
                if (aDebe !== bDebe) return bDebe - aDebe;
                
                const aCred = parseFloat(a.CredCtct || 0);
                const bCred = parseFloat(b.CredCtct || 0);
                if (aCred !== bCred) return bCred - aCred;
                
                const aDeta = (a.DetaCtct || a.DetailName || '').toString();
                const bDeta = (b.DetaCtct || b.DetailName || '').toString();
                return aDeta.localeCompare(bDeta);
            });
        }

        // Calculate chronological running balance from bottom to top
        let pgRunningBalance = 0;
        for (let i = displayData.length - 1; i >= 0; i--) {
            const row = displayData[i];
            const rowDebe = parseFloat(row.DebeCtct || 0);
            const rowReca = isMunic ? 0 : parseFloat(row.RecaCtct || 0);
            const rowCred = parseFloat(row.CredCtct || 0);
            const rowHaber = isMunic ? (rowDebe === 0 ? rowCred : Math.min(rowDebe, rowCred)) : rowCred;
            
            pgRunningBalance += rowDebe + rowReca - rowHaber;
            row.cumulativeBalance = pgRunningBalance;
        }

        const rows = [];
        let currentPeriod = null;
        let currentBime = null;
        let periodTotals = { debe: 0, reca: 0, haber: 0, total: 0 };

        let compareLegacyData = legacyData;
        if (isGrouped && !showQuotaDetail) {
            const mappedGroupLegacy = legacyData.reduce((acc, row) => {
                let p = parseInt(row.PeriCtct);
                let b = parseInt(row.BimeCtct);

                if (onlyDebt && p <= 2018) {
                    p = 2018;
                    b = 99;
                }

                const key = `${p}-${b}`;
                if (!acc[key]) {
                    acc[key] = { ...row, PeriCtct: p, BimeCtct: b, DebeCtct: 0, RecaCtct: 0, CredCtct: 0 };
                }
                acc[key].DebeCtct += parseFloat(row.DebeCtct || 0);
                acc[key].RecaCtct += parseFloat(row.RecaCtct || 0);
                acc[key].CredCtct += parseFloat(row.CredCtct || 0);
                return acc;
            }, {});
            compareLegacyData = Object.values(mappedGroupLegacy);
        }

        displayData.forEach((row, idx) => {
            // Check for period change for subtotals
            if (showSubtotals && (currentPeriod !== row.PeriCtct || currentBime !== row.BimeCtct)) {
                if (currentPeriod !== null) {
                    rows.push(<SubtotalRow key={`sub-${currentPeriod}-${currentBime}`} period={currentPeriod} bime={currentBime} totals={periodTotals} />);
                }
                currentPeriod = row.PeriCtct;
                currentBime = row.BimeCtct;
                periodTotals = { debe: 0, reca: 0, haber: 0, total: 0 };
            }

            const rowDebe = parseFloat(row.DebeCtct || 0);
            const rowCred = parseFloat(row.CredCtct || 0);

            periodTotals.debe += rowDebe;
            periodTotals.reca += (isMunic ? 0 : parseFloat(row.RecaCtct || 0));
            periodTotals.haber += (isMunic ? (rowDebe === 0 ? rowCred : Math.min(rowDebe, rowCred)) : rowCred);
            periodTotals.total += (isMunic ? (rowDebe - (rowDebe === 0 ? rowCred : Math.min(rowDebe, rowCred))) : parseFloat(row.TotaCtct || 0));

            // Comparison logic against appropriately grouped legacy data
            const legacyMatch = compareLegacyData.find(l => l.PeriCtct === row.PeriCtct && l.BimeCtct === row.BimeCtct);
            const isMismatchDebe = legacyMatch && Math.abs(parseFloat(legacyMatch.DebeCtct) - row.DebeCtct) > 0.1;
            const isMismatchReca = legacyMatch && Math.abs(parseFloat(legacyMatch.RecaCtct) - (row.RecaCtct || 0)) > 1.0;

            rows.push(
                <tr key={`pg-${idx}`} style={{ opacity: row.DetailRef === 'Multiple' ? 0.9 : 1 }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{row.PeriCtct}/{row.BimeCtct}</span>
                            <span title={row.DetailRef === 'Multiple' ? row.DetailName : (row.DetaCtct || row.TipoTributo)} style={{ cursor: 'help', opacity: 0.6 }}>
                                <Info size={14} />
                            </span>
                        </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                        {(() => {
                            const debe = parseFloat(row.DebeCtct || 0);
                            const displayDateVal = (debe === 0 && row.FechaPago && row.FechaPago !== '0001-01-01' && !row.FechaPago.startsWith('0001-01-01')) ? row.FechaPago : row.FeveCtct;
                            return displayDateVal ? new Date(displayDateVal).toLocaleDateString() : '-';
                        })()}
                    </td>
                    <td style={{ fontSize: '0.8rem', opacity: 0.9 }}>{row.DetaCtct || row.DetailName}</td>
                    <td style={{ textAlign: 'center' }}>
                        {row.hasApremio ? (
                            <span title={`Apremio: ${row.NumeApre || row.numeapre || 'Sí'}`} style={{ cursor: 'help' }}>
                                <CheckCircle2 size={16} color="#ef4444" />
                            </span>
                        ) : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                        {row.hasPlan ? (
                            <span title={`Plan: ${row.plnpgocod || row.CodiFapa || 'Sí'}`} style={{ cursor: 'help' }}>
                                <CheckCircle2 size={16} color="#3b82f6" />
                            </span>
                        ) : '-'}
                    </td>
                    <td style={{ color: isMismatchDebe ? '#fca5a5' : '#ef4444', fontWeight: isMismatchDebe ? 'bold' : 'normal' }}>
                        ${formatCurrency(row.DebeCtct)}
                    </td>
                    {!isMunic && (
                        <td style={{ color: isMismatchReca ? '#fca5a5' : '#f59e0b', fontWeight: isMismatchReca ? 'bold' : 'normal' }}>
                            ${formatCurrency(row.RecaCtct)}
                        </td>
                    )}
                    <td style={{ color: '#10b981' }}>
                        ${formatCurrency(isMunic ? (parseFloat(row.DebeCtct || 0) === 0 ? parseFloat(row.CredCtct || 0) : Math.min(parseFloat(row.DebeCtct || 0), parseFloat(row.CredCtct || 0))) : row.CredCtct)}
                    </td>

                    <td>
                        <div 
                            className={`status-pill ${row.NumeAcpa && row.NumeAcpa != '0' ? 'P' : 'D'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => fetchPgTicketHistory(row)}
                        >
                            {row.NumeAcpa && row.NumeAcpa != '0' ? 'Pagado' : 'Deuda'}
                        </div>
                        {row.NumeAcpa && row.NumeAcpa != '0' && (
                            <div style={{ fontSize: '0.7rem', marginTop: '2px', opacity: 0.7 }}>
                                Ref: {row.NumeAcpa}
                                {row.FechaPago && row.FechaPago !== '0001-01-01' && (
                                    <div style={{ fontWeight: 'bold' }}>F. Pago: {new Date(row.FechaPago).toLocaleDateString()}</div>
                                )}
                            </div>
                        )}
                    </td>
                </tr>
            );
        });

        // Add last subtotal
        if (showSubtotals && currentPeriod !== null) {
            rows.push(<SubtotalRow key={`sub-last`} period={currentPeriod} bime={currentBime} totals={periodTotals} />);
        }

        return rows;
    };

    const ownerData = postgresData.length > 0 ? postgresData[0] : null;
    const ownerNameFallback = ownerData?.OwnerName?.trim() || (legacyData.length > 0 ? "Titular Encontrado" : null);

    const PersonModal = ({ person, onClose }) => {
        if (!person) return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>Información no disponible</h2>
                        <button className="close-btn" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <p>No se encontraron datos extendidos de la persona en el sistema de migración.</p>
                    </div>
                </div>
            </div>
        );
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>Detalles de la Persona</h2>
                        <button className="close-btn" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Nombre:</label>
                                <span>{person.OwnerName || 'Desconocido'}</span>
                            </div>
                            <div className="info-item">
                                <label>CUIT/CUIL:</label>
                                <span>{person.CUIT === '--' ? 'Sin CUIT' : person.CUIT}</span>
                            </div>
                            <div className="info-item">
                                <label>Percod:</label>
                                <span>{person.PersonId || '-'}</span>
                            </div>
                            <div className="info-item">
                                <label>Actividad:</label>
                                <span>{person.TipoActividad || 'Información no disponible'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="ctacte-view">
            {selectedPerson !== null && <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
            {/* Top Toolbar */}
            <div className="toolbar-dashboard">
                {ownerNameFallback && (
                    <div className="owner-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setSelectedPerson(ownerData)}>
                        <Info size={20} color="var(--primary)" />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                                {ownerNameFallback} {ownerData?.PersonId && <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>({ownerData.PersonId})</span>}
                                {legacyData[0]?.AccountName && (
                                    <span style={{ marginLeft: '15px', color: '#fbbf24', fontSize: '1.1rem', borderLeft: '2px solid rgba(255,255,255,0.2)', paddingLeft: '15px' }}>
                                        {legacyData[0].AccountName}
                                    </span>
                                )}
                                {postgresData.length > 0 && searchBy === 'person' && (
                                    <span style={{ marginLeft: '10px', color: '#10b981', fontSize: '1rem', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                        <strong>Cta:</strong> {
                                            [...new Set(postgresData.map(d => d.CuenCtct))].map((accNum, i, arr) => (
                                                <span key={accNum}>
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); quickSearchAccount(accNum); }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            textDecoration: 'underline',
                                                            fontWeight: 'bold',
                                                            padding: '0 2px'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = '#10b981'}
                                                    >
                                                        {accNum}
                                                    </span>
                                                    {i < arr.length - 1 ? ', ' : ''}
                                                </span>
                                            ))
                                        }
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.85rem', opacity: 0.8 }}>
                                {ownerData?.CUIT && ownerData.CUIT !== '--' && <span><strong>CUIT:</strong> {ownerData.CUIT}</span>}
                                {ownerData?.TipoActividad && (
                                    <span className="activity-badge" style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '2px 8px', borderRadius: '12px', color: '#60a5fa' }}>
                                        {ownerData.TipoActividad}
                                    </span>
                                )}
                                {postgresData.length > 0 && (
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '4px' }}>
                                        <span style={{ color: 'var(--primary)', opacity: 0.9 }}>
                                            <strong>ID Tributo:</strong> {postgresData[0].TributoID} - {postgresData[0].TipoTributo}
                                        </span>
                                        {postgresData[0].Nomenclatura && (
                                            <span style={{ color: '#10b981' }}>
                                                <strong>Nom:</strong> {postgresData[0].Nomenclatura}
                                            </span>
                                        )}
                                        {postgresData[0].Pabellon && (
                                            <span style={{ color: '#f59e0b' }}>
                                                <strong>Pab:</strong> {postgresData[0].Pabellon.trim()}
                                                {postgresData[0].Nicho && <span><strong> Nicho:</strong> {postgresData[0].Nicho.trim()}</span>}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); setShowPersonDropdown(false); handleSearch(e); }} className="search-controls" style={{ flexWrap: 'wrap' }}>
                    <div className="input-group">
                        <Filter size={18} />
                        <select
                            value={searchBy}
                            onChange={(e) => {
                                setSearchBy(e.target.value);
                                setAccount('');
                                setPersonSearchText('');
                                setPersonSearchResults([]);
                                setShowPersonDropdown(false);
                                setFoundOffices([]);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'white', padding: '0.5rem' }}
                        >
                            <option value="account">Por Cuenta</option>
                            <option value="person">Por Persona</option>
                        </select>
                    </div>

                    <div className="input-group" style={{ position: 'relative' }}>
                        <Search size={18} />
                        {searchBy === 'account' ? (
                            <input
                                type="text"
                                placeholder="Nro. Cuenta"
                                value={account}
                                onChange={(e) => setAccount(e.target.value)}
                                onFocus={(e) => e.target.select()}
                            />
                        ) : (
                            <>
                                <input
                                    type="text"
                                    placeholder="Nombre, CUIT (20-12345678-9), DNI o Percod"
                                    value={personSearchText}
                                    onChange={(e) => {
                                        setPersonSearchText(e.target.value);
                                        // If they clear the input, clear selection
                                        if (!e.target.value) {
                                            setAccount('');
                                            setPersonSearchResults([]);
                                        }
                                    }}
                                    onFocus={(e) => {
                                        e.target.select();
                                        if (personSearchResults.length > 0) setShowPersonDropdown(true);
                                    }}
                                    style={{ minWidth: '280px' }}
                                />
                                {isSearchingPerson && <div className="loader-mini"></div>}
                                {showPersonDropdown && (
                                    <div className="person-dropdown" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '0 0 8px 8px',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        zIndex: 1000,
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                                    }}>
                                        {personSearchResults.map((p, i) => (
                                            <div
                                                key={i}
                                                className="person-option"
                                                onClick={() => handleSelectPerson(p)}
                                                style={{
                                                    padding: '0.6rem 1rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.15)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p.pernom}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.7, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                    <span>ID: {p.percod}</span>
                                                    {p.cuit && <span>CUIT: {p.cuit}</span>}
                                                    {p.accounts && p.accounts.length > 0 && (
                                                        <span style={{ color: '#10b981' }}>
                                                            Ctas: {p.accounts.map(a => `${a.account} (${a.officeName})`).join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                        {isResolvingOffices && <div className="loader-mini"></div>}
                    </div>

                    <div className="input-group" style={{
                        border: foundOffices.length > 1 ? '1px solid #fbbf24' : '1px solid var(--border)',
                        animation: foundOffices.length > 1 ? 'pulse-border 2s infinite' : 'none'
                    }}>
                        <Filter size={18} color={foundOffices.length > 1 ? '#fbbf24' : 'currentColor'} />
                        <select
                            value={selectedOffice}
                            onChange={(e) => {
                                setSelectedOffice(e.target.value);
                                setSelectedAccountFilter('all');
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'white', padding: '0.5rem', width: '180px' }}
                        >
                            {foundOffices.length > 0 ? (
                                foundOffices.map(off => (
                                    <option key={off.id} value={off.id}>{off.name} ({off.id})</option>
                                ))
                            ) : (
                                <option value="">Seleccione Oficina...</option>
                            )}
                        </select>
                        {foundOffices.length > 1 && <span className="badge-warning">!</span>}
                    </div>

                    {searchBy === 'person' && personAccounts.length > 0 && (
                        <div className="input-group" style={{ border: '1px solid var(--primary)' }}>
                            <FileText size={18} color="var(--primary)" />
                            <select
                                value={selectedAccountFilter}
                                onChange={(e) => setSelectedAccountFilter(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'white', padding: '0.5rem', width: '180px' }}
                            >
                                <option value="all">Todas las Cuentas</option>
                                {personAccounts
                                    .filter(a => a.officeId.toString() === selectedOffice)
                                    .map(a => (
                                        <option key={a.account} value={a.account}>{a.account}</option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    <div className="input-group" style={{ paddingLeft: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '2px' }}>
                            <label style={{ fontSize: '0.65rem', color: '#fbbf24' }}>Año</label>
                            <input
                                type="number"
                                placeholder="AAAA"
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: '#fbbf24', width: '80px', fontSize: '1.1rem', fontWeight: 'bold' }}
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ paddingLeft: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '2px' }}>
                            <label style={{ fontSize: '0.65rem', color: '#fbbf24' }}>Cuota</label>
                            <input
                                type="number"
                                placeholder="1-12"
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: '#fbbf24', width: '60px', fontSize: '1.1rem', fontWeight: 'bold' }}
                            />
                        </div>
                    </div>

                    {isFiltersExpanded && (
                        <>
                            <div className="input-group">
                                <Calendar size={18} />
                                <div style={{ display: 'flex', flexDirection: 'column', padding: '2px' }}>
                                    <label style={{ fontSize: '0.65rem', opacity: 0.7, marginLeft: '0.5rem' }}>Fecha Tope (Interés)</label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', color: 'white' }}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button id="btn-main-search" type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.8rem 2rem', fontWeight: 'bold' }}>
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                            style={{ 
                                background: 'transparent', border: '1px solid var(--border)', color: 'white', 
                                padding: '0.8rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' 
                            }}
                        >
                            <Filter size={16} /> {isFiltersExpanded ? 'Opciones' : 'Más'}
                        </button>

                        {isMunic && (
                            <button
                                type="button"
                                className="btn-pdf"
                                disabled={!account || loading || (legacyData.length === 0 && postgresData.length === 0)}
                                onClick={handleGeneratePDF}
                                style={{ padding: '0.8rem 1.5rem' }}
                            >
                                <Download size={18} style={{ marginRight: '8px' }} />
                                Vista Previa PDF
                            </button>
                        )}
                    </div>

                    {/* Second Row for Filters and Actions */}
                    <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border)' }}>
                        {isFiltersExpanded && (
                            <>
                                <div className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        id="onlyDebt"
                                        checked={onlyDebt}
                                        onChange={(e) => setOnlyDebt(e.target.checked)}
                                    />
                                    <label htmlFor="onlyDebt">Solo Deuda</label>
                                </div>

                                <div className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        id="showQuotaDetail"
                                        checked={showQuotaDetail}
                                        onChange={(e) => setShowQuotaDetail(e.target.checked)}
                                    />
                                    <label htmlFor="showQuotaDetail" title="Postgres: Muestra GeneracionCuota">Detalle Cuotas (P)</label>
                                </div>

                                <div className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        id="showSubtotals"
                                        checked={showSubtotals}
                                        onChange={(e) => setShowSubtotals(e.target.checked)}
                                    />
                                    <label htmlFor="showSubtotals">Totales Periodo</label>
                                </div>

                                <div className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        id="isGrouped"
                                        checked={isGrouped}
                                        onChange={(e) => setIsGrouped(e.target.checked)}
                                    />
                                    <label htmlFor="isGrouped">Agrupar Cuotas</label>
                                </div>

                                <div className="divider-vertical" style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.5rem' }}></div>
                            </>
                        )}

                        {!isMunic && (
                            <button
                                type="button"
                                className="btn-pdf"
                                disabled={!account || loading || (legacyData.length === 0 && postgresData.length === 0)}
                                onClick={handleGeneratePDF}
                            >
                                Vista Previa PDF
                            </button>
                        )}

                        {!isMunic && (
                            <>
                                {user?.rol === 'superadmin' && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn-sql"
                                            onClick={() => setShowSqlMariaModal(true)}
                                        >
                                            SQL MariaDB
                                        </button>

                                        <button
                                            type="button"
                                            className="btn-sql"
                                            onClick={() => setShowSqlPgModal(true)}
                                        >
                                            SQL Postgres
                                        </button>
                                    </>
                                )}

                                <button
                                    type="button"
                                    className="btn-sql"
                                    onClick={openManual}
                                    style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)' }}
                                >
                                    Manual de Lógica
                                </button>

                                <button
                                    type="button"
                                    className="btn-sql"
                                    onClick={() => setShowFormulaModal(true)}
                                    style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.2)' }}
                                >
                                    Ver Fórmula Interés
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>

            {/* Split Panels */}
            <div className="split-panels">
                {/* Legacy Panel (MariaDB) */}
                <div className="panel legacy-panel" style={{ width: `${leftWidth}%`, flex: 'none' }}>
                    <div className="panel-header">
                        <h3>SISTEMA ORIGINAL (MARIADB)</h3>
                        <div className="db-badge maria">Legacy</div>
                    </div>

                    <div className="table-container">
                        {error && <div className="error-msg"><AlertCircle size={16} /> {error}</div>}
                        {legacyData.length > 0 ? (
                            <table className="comparison-table">
                                <thead>
                                    <tr>
                                        <th>Periodo</th>
                                        <th>Fecha Venc</th>
                                        <th>Detalle</th>
                                        <th>Apr.</th>
                                        <th>Plan</th>
                                        <th>Debe</th>
                                        {!isMunic && <th>Recargo</th>}
                                        <th>Haber</th>
                                        <th>Estado/Ref</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderRows()}
                                </tbody>
                                <tfoot style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold' }}>
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'right' }}>TOTALES GENERALES:</td>
                                        <td style={{ color: '#ef4444' }}>
                                            ${formatCurrency(legacyData.reduce((acc, row) => acc + parseFloat(row.DebeCtct || 0), 0))}
                                        </td>
                                        {!isMunic && (
                                            <td style={{ color: '#f59e0b' }}>
                                                ${formatCurrency(legacyData.reduce((acc, row) => acc + parseFloat(row.RecaCtct || 0), 0))}
                                            </td>
                                        )}
                                        <td style={{ color: '#10b981' }}>
                                            ${formatCurrency(legacyData.reduce((acc, row) => {
                                                const d = parseFloat(row.DebeCtct || 0);
                                                const h = parseFloat(row.CredCtct || 0);
                                                return acc + (isMunic ? (d === 0 ? h : Math.min(d, h)) : h);
                                            }, 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <div className="empty-state">
                                {!loading && <p>No hay datos para mostrar. Realiza una búsqueda.</p>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Resizer Divider */}
                <div
                    className={`resizer ${isResizing ? 'resizing' : ''}`}
                    onMouseDown={handleMouseDown}
                />

                {/* New Panel (Postgres) */}
                <div className="panel new-panel" style={{ width: `${100 - leftWidth}%`, flex: 'none' }}>
                    <div className="panel-header">
                        <h3>SISTEMA NUEVO (POSTGRESQL)</h3>
                        <div className="db-badge postgres">Postgres</div>
                    </div>

                    <div className="table-container">
                        {postgresError && <div className="error-msg"><AlertCircle size={16} /> {postgresError}</div>}
                        {postgresData.length > 0 ? (
                            <table className="comparison-table">
                                <thead>
                                    <tr>
                                        <th>Periodo</th>
                                        <th>Vencimiento</th>
                                        <th>Concepto</th>
                                        <th>Apr.</th>
                                        <th>Plan</th>
                                        <th>Debe</th>
                                        {!isMunic && <th>Interés</th>}
                                        <th>Haber</th>
                                        <th>Estado/Ref</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderPostgresRows()}
                                </tbody>
                                <tfoot style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold' }}>
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'right' }}>TOTALES POSTGRES:</td>
                                        <td style={{ color: '#ef4444' }}>
                                            ${formatCurrency(postgresData.reduce((acc, row) => acc + parseFloat(row.DebeCtct || 0), 0))}
                                        </td>
                                        {!isMunic && (
                                            <td style={{ color: '#f59e0b' }}>
                                                ${formatCurrency(postgresData.reduce((acc, row) => acc + parseFloat(row.RecaCtct || 0), 0))}
                                            </td>
                                        )}
                                        <td style={{ color: '#10b981' }}>
                                            ${formatCurrency(postgresData.reduce((acc, row) => {
                                                const d = parseFloat(row.DebeCtct || 0);
                                                const h = parseFloat(row.CredCtct || 0);
                                                return acc + (isMunic ? (d === 0 ? h : Math.min(d, h)) : h);
                                            }, 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <div className="empty-state">
                                {!loading && !postgresError && (
                                    <>
                                        <p>No hay datos en Postgres para esta cuenta.</p>
                                        <Info size={24} opacity={0.3} />
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {showPdfModal && (
                <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
                    <div className="modal-content pdf-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={18} style={{ marginRight: '8px' }} /> Vista Previa del Informe</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <a
                                    href={pdfBlobUrl}
                                    download={`informe_auditoria_${account || 'export'}.pdf`}
                                    className="btn btn-pdf"
                                    style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#2563eb' }}
                                >
                                    <Download size={14} /> Descargar
                                </a>
                                <button className="close-btn" onClick={() => setShowPdfModal(false)}>&times;</button>
                            </div>
                        </div>
                        <div style={{ flex: 1, background: '#525659', padding: '10px', minHeight: 0, display: 'flex' }}>
                            <iframe
                                src={pdfBlobUrl}
                                width="100%"
                                style={{ border: 'none', borderRadius: '4px', flex: 1, minHeight: '500px' }}
                                title="PDF Preview"
                            />
                        </div>
                    </div>
                </div>
            )}

            {showSqlMariaModal && user?.rol === 'superadmin' && (
                <div className="modal-overlay" onClick={() => setShowSqlMariaModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Consulta SQL MariaDB (Legacy)</h3>
                            <button className="close-btn" onClick={() => setShowSqlMariaModal(false)}>&times;</button>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.9rem' }}>
                            <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.5rem' }}>⚠️ Atención: Elementos faltantes para la lectura de MariaDB</strong>
                            Faltan restaurar las siguientes entidades en el servidor de MariaDB para que se puedan traer los datos de la cuenta corriente Legacy:
                            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', color: '#f8fafc' }}>
                                <li style={{ marginBottom: '0.2rem' }}><strong>Base de datos <code>recaudacion</code>:</strong> Tablas <code>oficina</code>, <code>ctacte</code>, <code>concepto</code>.</li>
                                <li><strong>Base de datos <code>recahisto</code>:</strong> Tabla <code>histoctacte</code> (Opcional, recomendada para historial completo anterior a cortes).</li>
                            </ul>
                        </div>

                        <pre className="sql-code">
                            {`-- CONSULTA HISTÓRICA DE CUENTA CORRIENTE LEGACY (MARIADB)
-- El backend aplica resolución inteligente de cuentas para tasas de personas unificadas (Oficinas 3 y 5)

-- CASO A: Búsqueda con Filtro "Solo Deuda" (onlyDebt = true)
SELECT 
    t.PeriCtct, 
    t.BimeCtct, 
    MAX(t.CuotDefa) as CuotDefa, 
    MAX(t.FeveCtct) as FeveCtct, 
    IFNULL(c.DetaConc, MAX(t.DetaCtct)) as DetaCtct, 
    SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0)) as DebeCtct, 
    IF(MAX(t.FeveCtct) < '\${toDate}', 
       (SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0))) * CEIL(DATEDIFF('\${toDate}', MAX(t.FeveCtct)) / 30) * 0.03, 
       0) as RecaCtct, 
    MAX(t.NumeAcpa) as NumeAcpa, 
    MAX(t.FeenAcpa) as FechaPago, 
    MAX(t.NumeBole) as NumeBole, 
    MAX(t.NumeApre) as NumeApre, 
    MAX(t.CodiFapa) as CodiFapa, 
    (MAX(t.NumeApre) > 0) as hasApremio, 
    (MAX(t.CodiFapa) > 0) as hasPlan 
FROM recaudacion2.ctacte t 
LEFT JOIN recaudacion2.concepto c ON c.PeriInfo = t.PeriInfo AND c.CodiConc = t.CodiConc 
WHERE t.CodiOfic = '\${selectedOffice}' AND t.CuenCtct = '\${account}' 
GROUP BY t.PeriCtct, t.BimeCtct, t.PeriInfo, t.CodiConc 
HAVING (SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0))) > 0.01 
ORDER BY t.PeriCtct DESC, t.BimeCtct ASC;

-- CASO B: Búsqueda de Estado de Cuenta Completo (Historial Completo)
SELECT 
    tmp.CuenCtct, 
    tmp.PeriCtct, 
    tmp.BimeCtct, 
    tmp.CuotDefa, 
    tmp.FeveCtct, 
    IFNULL(c.DetaConc, tmp.DetaCtct) as DetaCtct, 
    tmp.DebeCtct, 
    tmp.CredCtct, 
    0 as RecaCtct, 
    (tmp.DebeCtct - tmp.CredCtct) as TotaCtct, 
    tmp.NumeAcpa, 
    tmp.FechaPago, 
    tmp.NumeApre, 
    tmp.CodiFapa, 
    (tmp.NumeApre > 0) as hasApremio, 
    (tmp.CodiFapa > 0) as hasPlan 
FROM (
    -- Movimientos activos en cuenta corriente de producción
    SELECT CuenCtct, PeriCtct, BimeCtct, CuotDefa, FeveCtct, DetaCtct, DebeCtct, CredCtct, NumeApre, CodiFapa, PeriInfo, CodiConc, NumeAcpa, FeenAcpa as FechaPago 
    FROM recaudacion2.ctacte 
    WHERE CodiOfic = '\${selectedOffice}' AND CuenCtct = '\${account}'
    
    UNION ALL 
    
    -- Movimientos históricos (anteriores a cortes de migración)
    SELECT CuenCtct, PeriCtct, BimeCtct, CuotDefa, FeveCtct, DetaCtct, DebeCtct, CredCtct, NumeApre, CodiFapa, PeriInfo, CodiConc, NumeAcpa, FeenAcpa as FechaPago 
    FROM recahisto.histoctacte 
    WHERE CodiOfic = '\${selectedOffice}' AND CuenCtct = '\${account}'
) tmp 
LEFT JOIN recaudacion2.concepto c ON c.PeriInfo = tmp.PeriInfo AND c.CodiConc = tmp.CodiConc 
ORDER BY tmp.PeriCtct DESC, tmp.BimeCtct ASC, tmp.FeveCtct ASC 
LIMIT 2000;`}
                        </pre>
                    </div>
                </div>
            )}

            {showSqlPgModal && user?.rol === 'superadmin' && (
                <div className="modal-overlay" onClick={() => setShowSqlPgModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Consulta SQL PostgreSQL (Nuevo)</h3>
                            <button onClick={() => setShowSqlPgModal(false)}>&times;</button>
                        </div>
                        <pre className="sql-code">
                            {`SELECT 
    cc.ctactecod, gc.genctaancta as "PeriCtct", gc.genctanrocta as "BimeCtct", 
    cc.ctactefchalta, gc.genctafchvto as "FeveCtct", 
    ${showQuotaDetail ? 'gcd.genctadetimp' : 'gc.genctaimpcta'} as "DebeCtct",
    gc.genctacednro as "NumeApre",
    cc.cabpgoctactecod as "NumeAcpa",
    cc.plnpgocod,
    tt.tpotribnom as "TipoTributo",
    p.pernom as "Titular"
FROM public.generacioncuota gc
${showQuotaDetail ? 'LEFT JOIN public.generacioncuotadetalle gcd ON gc.genctacod = gcd.genctadetcod' : ''}
LEFT JOIN public.cuentacorriente cc ON cc.genctacod = gc.genctacod
INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
INNER JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
INNER JOIN public.persona p ON gc.genctapercod = p.percod 
WHERE ${searchBy === 'person' ? `gc.genctapercod = (SELECT percod FROM persona WHERE ...)` : `t.tbecod = '${account}'`}
AND tt.tpotribcod = '${selectedOffice}'
${onlyDebt ? 'AND (cc.cabpgoctactecod IS NULL OR cc.cabpgoctactecod = 0)' : ''}
ORDER BY gc.genctaancta DESC, gc.genctanrocta DESC;`}
                        </pre>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    background: #1e293b;
                    padding: 0;
                    border-radius: 12px;
                    width: 80%;
                    max-width: 900px;
                    max-height: 80vh;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-direction: column;
                }

                .pdf-modal {
                    width: 90%;
                    height: 90vh;
                    max-width: 1200px;
                }

                .modal-header {
                    padding: 1rem 1.5rem;
                    background: rgba(0,0,0,0.2);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .modal-header h3 { color: white; margin: 0; font-size: 1.1rem; }
                .modal-header button { 
                    background: transparent; 
                    border: none; 
                    color: white; 
                    font-size: 1.5rem; 
                    cursor: pointer; 
                }

                .sql-code {
                    padding: 1.5rem;
                    background: #0f172a;
                    color: #94a3b8;
                    font-family: 'Consolas', monospace;
                    font-size: 0.85rem;
                    line-height: 1.5;
                    overflow: auto;
                    margin: 0;
                }

                .btn-sql {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #94a3b8;
                    padding: 0.4rem 0.8rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    transition: all 0.2s;
                }

                .btn-sql:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }

                .loader-mini {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: spin 1s linear infinite;
                    margin-left: -25px;
                    margin-right: 10px;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @keyframes pulse-border {
                    0% { border-color: rgba(251, 191, 36, 0.4); }
                    50% { border-color: rgba(251, 191, 36, 1); }
                    100% { border-color: rgba(251, 191, 36, 0.4); }
                }

                .badge-warning {
                    background: #fbbf24;
                    color: #000;
                    font-weight: bold;
                    border-radius: 50%;
                    width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    margin-right: 5px;
                }

                .ctacte-view {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 64px);
                }

                .toolbar-dashboard {
                    padding: 1rem 2rem;
                    background: var(--glass);
                    border-bottom: 1px solid var(--border);
                }

                .search-controls {
                    display: flex;
                    gap: 1.5rem;
                    align-items: center;
                }

                .input-group {
                    display: flex;
                    align-items: center;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    padding-left: 0.75rem;
                }

                .input-group input, .input-group select {
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.5rem 0.75rem;
                    outline: none;
                    font-size: 0.9rem;
                    cursor: pointer;
                }

                .input-group select option {
                    background-color: #1e293b;
                    color: white;
                }

                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    color: var(--text-dim);
                }

                .btn-search {
                    background: var(--primary);
                    color: white;
                    border: none;
                    padding: 0.5rem 1.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: background 0.2s;
                }
                .btn-search:hover { background: #1d4ed8; }

                /* Modals */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    background: #1e293b;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 900px;
                    height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                }

                .modal-header {
                    padding: 1rem 1.5rem;
                    background: #0f172a;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    color: white;
                    display: flex;
                    align-items: center;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                }
                .close-btn:hover { opacity: 1; }

                .pdf-modal {
                    max-width: 1100px;
                    width: 95%;
                }

                .btn-pdf {
                    background: #dc2626;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .btn-pdf:hover { background: #b91c1c; transform: translateY(-1px); }
                .btn-pdf:disabled { opacity: 0.5; cursor: not-allowed; }

                .split-panels {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: nowrap;
                    padding: 1.5rem;
                    flex: 1;
                    overflow: hidden;
                    width: 100%;
                    gap: 0;
                }

                .panel {
                    background: var(--card-bg);
                    border-radius: 12px;
                    border: 1px solid var(--glass-border);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    min-width: 100px;
                }

                .panel-header {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(0,0,0,0.1);
                    flex-shrink: 0;
                }

                .panel-header h3 { font-size: 0.9rem; font-weight: 700; opacity: 0.8; }

                .db-badge {
                    font-size: 0.7rem;
                    padding: 0.2rem 0.6rem;
                    border-radius: 4px;
                    text-transform: uppercase;
                    font-weight: 800;
                }
                .db-badge.maria { background: rgba(16, 185, 129, 0.2); color: #10b981; }
                .db-badge.postgres { background: rgba(37, 99, 235, 0.2); color: #2563eb; }

                .table-container { 
                    flex: 1; 
                    overflow-y: auto; 
                    overflow-x: auto; 
                    padding: 0.5rem; 
                }

                .comparison-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }

                .comparison-table th {
                    text-align: left;
                    padding: 0.75rem;
                    background: var(--surface);
                    color: var(--text-dim);
                    border-bottom: 2px solid var(--border);
                }

                .comparison-table td {
                    padding: 0.35rem 0.75rem;
                    border-bottom: 1px solid rgba(255,255,255,0.02);
                    transition: background 0.1s;
                }

                .comparison-table tr:hover td {
                    background: rgba(255, 255, 255, 0.05);
                }

                .cell-total { color: #f8fafc; font-weight: 600; }

                .status-pill {
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                }
                .status-pill.P { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .status-pill.D { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .status-pill.W { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--text-dim);
                    gap: 1rem;
                }

                .error-msg {
                    padding: 1rem;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border-radius: 6px;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .owner-header {
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: var(--glass);
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--primary);
                    color: white;
                    font-size: 1rem;
                }

                .owner-header strong {
                    color: var(--primary);
                    text-transform: uppercase;
                    font-size: 0.8rem;
                    letter-spacing: 0.05rem;
                }

                @media (max-width: 1024px) {
                    .split-panels {
                        flex-direction: column;
                        overflow-y: visible;
                        gap: 2rem;
                    }

                    .panel {
                        width: 100% !important;
                        height: auto !important;
                        min-height: auto;
                    }

                    .resizer {
                        display: none;
                    }

                    .search-controls {
                        justify-content: center;
                    }

                    .ctacte-view {
                        height: auto;
                        min-height: 100vh;
                        overflow-y: visible;
                    }
                }

                @media (max-width: 768px) {
                    .toolbar-dashboard {
                        padding: 1rem;
                    }

                    .search-controls {
                        gap: 0.8rem;
                    }

                    .input-group {
                        width: 100%;
                    }

                    .input-group input, .input-group select {
                        width: 100% !important;
                    }

                    .btn-search, .btn-pdf, #btn-main-search {
                        width: 100%;
                        justify-content: center;
                    }

                    .owner-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                }
            `}</style>
            {/* Modal Manual de Lógica */}
            {showManualModal && (
                <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
                    <div className="modal-content" style={{ width: '80%', maxWidth: '800px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Manual de Lógica de Composición de Deuda</h3>
                            <button onClick={() => setShowManualModal(false)} className="close-btn">&times;</button>
                        </div>
                        <div className="modal-body" style={{ background: '#1a1d21', color: '#e0e0e0', padding: '30px', overflowY: 'auto' }}>
                            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.6' }}>
                                {manualContent}
                            </pre>
                        </div>
                        <div className="modal-footer" style={{ marginTop: 0, paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button onClick={() => setShowManualModal(false)} className="btn btn-pdf" style={{ background: '#475569' }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Explicación Fórmula */}
            {showFormulaModal && (
                <div className="modal-overlay" onClick={() => setShowFormulaModal(false)}>
                    <div className="modal-content" style={{ width: '90%', maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '1px solid #fbbf24' }}>
                            <h3 style={{ color: '#fbbf24' }}>¿Cómo se calcula el Interés?</h3>
                            <button onClick={() => setShowFormulaModal(false)} className="close-btn">&times;</button>
                        </div>
                        <div className="modal-body" style={{ background: '#111827', color: '#f3f4f6', padding: '2rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <section>
                                    <h4 style={{ color: '#fbbf24', marginBottom: '0.5rem' }}>1. La Tasa Mensual</h4>
                                    <p style={{ opacity: 0.9 }}>
                                        El sistema utiliza una tasa del <strong>3% mensual</strong> (que sube al <strong>8% mensual</strong> para periodos posteriores a Mayo 2024).
                                    </p>
                                </section>

                                <section>
                                    <h4 style={{ color: '#fbbf24', marginBottom: '0.5rem' }}>2. Cálculo por Día (Fórmula Exponencial)</h4>
                                    <p style={{ opacity: 0.9, marginBottom: '0.5rem' }}>
                                        Para ser justos, no dividimos la tasa por 30. Usamos una fórmula que calcula cuánto corresponde a cada día exacto de atraso:
                                    </p>
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px dashed #fbbf24', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                        Tasa Diaria = (1 + TasaMensual) <sup>1/30</sup> - 1
                                    </div>
                                </section>

                                <section>
                                    <h4 style={{ color: '#fbbf24', marginBottom: '0.5rem' }}>3. Resultado</h4>
                                    <p style={{ opacity: 0.9 }}>
                                        Esa tasa diaria se aplica por cada día transcurrido desde el <strong>Vencimiento</strong> hasta la <strong>Fecha de Cálculo</strong>.
                                    </p>
                                </section>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ background: '#111827', borderTop: '1px solid rgba(251, 191, 36, 0.2)' }}>
                            <button onClick={() => setShowFormulaModal(false)} className="btn btn-pdf" style={{ background: '#fbbf24', color: '#000' }}>Entendido</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Historial de Boletos (NUEVO) */}
            {showTicketsModal && (
                <div className="modal-overlay" onClick={() => setShowTicketsModal(false)}>
                    <div className="modal-content" style={{ width: '90%', maxWidth: '850px', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: '1px solid var(--primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={20} color="var(--primary)" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>Historial de Boletos Emitidos</h3>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)' }}>Período {selectedPeriodForTickets}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowTicketsModal(false)} className="close-btn">&times;</button>
                        </div>
                        <div className="modal-body" style={{ padding: '2rem', background: 'var(--bg)', overflowY: 'auto' }}>
                            {isFetchingTickets ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--primary)' }}>
                                    <div className="spin" style={{ marginBottom: '1rem', display: 'inline-block' }}><RefreshCw size={32} /></div>
                                    <p>Consultando base de datos MariaDB...</p>
                                </div>
                            ) : ticketHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                                    <AlertCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                    <p>No se encontraron boletos emitidos para este período en MariaDB.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                        {ticketHistory.map((t, idx) => (
                                            <div key={idx} style={{ 
                                                background: 'var(--card)', 
                                                borderRadius: '12px', 
                                                border: `1px solid ${t.EstaBole === 'Emitido' ? 'rgba(255,255,255,0.1)' : 'var(--primary)'}`,
                                                padding: '1.5rem',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}>
                                                {t.EstaBole !== 'Emitido' && (
                                                    <div style={{ 
                                                        position: 'absolute', top: 0, right: 0, 
                                                        background: 'var(--primary)', color: 'white', 
                                                        fontSize: '0.65rem', padding: '4px 12px', 
                                                        borderBottomLeftRadius: '8px', fontWeight: 'bold' 
                                                    }}>
                                                        ACTUALIZADO / PAGADO
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', display: 'block', textTransform: 'uppercase' }}>Boleto #</span>
                                                        <strong style={{ fontSize: '1.25rem' }}>{t.NumeBole}</strong>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', display: 'block', textTransform: 'uppercase' }}>Emisión</span>
                                                        <span style={{ fontSize: '0.85rem' }}>{new Date(t.AltaFeho).toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                                                    <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', display: 'block' }}>CAPITAL</span>
                                                        <span style={{ fontWeight: 'bold', color: '#cbd5e1' }}>${formatCurrency(t.CapiBole)}</span>
                                                    </div>
                                                    <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', display: 'block' }}>RECARGOS</span>
                                                        <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>${formatCurrency(t.RecaBole)}</span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '0.75rem' }}>
                                                        <span style={{ color: 'var(--text-dim)' }}>Usuario: </span>
                                                        <strong>{t.UserName || t.CodiUsua}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                        ${formatCurrency(t.TotaBole)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ 
                                        padding: '1rem', 
                                        background: 'rgba(245, 158, 11, 0.05)', 
                                        border: '1px solid rgba(245, 158, 11, 0.2)', 
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        color: '#f59e0b',
                                        display: 'flex',
                                        gap: '10px'
                                    }}>
                                        <Info size={20} style={{ flexShrink: 0 }} />
                                        <span>
                                            <strong>Nota de Auditoría:</strong> La diferencia entre el capital de los boletos emitidos puede causar que el estado figure como "Parcial" si el ajuste no fue impactado correctamente en la Cuenta Corriente de MariaDB.
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ background: 'var(--surface)', display: 'flex', justifyContent: 'space-between' }}>
                            <button 
                                onClick={() => generateAuditPDF(selectedRowForAudit, ticketHistory)} 
                                className="btn btn-pdf" 
                                style={{ background: '#10b981' }}
                                disabled={ticketHistory.length === 0 || !selectedRowForAudit}
                            >
                                <Download size={16} style={{ marginRight: '8px' }} />
                                Descargar Informe
                            </button>
                            <button onClick={() => setShowTicketsModal(false)} className="btn btn-pdf" style={{ background: 'var(--primary)' }}>Cerrar Historial</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Historial de Boletos Postgres */}
            {showPgTicketsModal && (
                <div className="modal-overlay" onClick={() => setShowPgTicketsModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: '#2563eb' }}>
                            <h3><Calendar size={18} style={{ marginRight: '8px' }} /> Historial Migrado en Postgres</h3>
                            <button className="close-btn" onClick={() => setShowPgTicketsModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ background: '#111827', padding: '0' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(37, 99, 235, 0.05)' }}>
                                <h4 style={{ margin: 0, color: '#60a5fa' }}>Período {selectedPeriodForTickets}</h4>
                                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
                                    Padrón: {selectedRowForAudit?.CuenCtct} - {selectedRowForAudit?.OwnerName || selectedPerson?.text}
                                </p>
                            </div>

                            {isFetchingPgTickets ? (
                                <div style={{ padding: '3rem', textAlign: 'center' }}>
                                    <div className="loader-mini" style={{ width: '30px', height: '30px', margin: '0 auto 1rem' }}></div>
                                    <p>Consultando registros migrados...</p>
                                </div>
                            ) : pgTicketHistory.length > 0 ? (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="comparison-table" style={{ width: '100%' }}>
                                        <thead style={{ background: 'rgba(0,0,0,0.3)' }}>
                                            <tr>
                                                <th>Conc / Boleto</th>
                                                <th>Detalle Concepto</th>
                                                <th>Fecha</th>
                                                <th>Importe</th>
                                                <th>Boleto Pago (P)</th>
                                                <th>Est.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pgTicketHistory.map((t, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>
                                                        {t.BoletoOriginal || '-'}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem' }}>
                                                        {t.ConceptoNombre || <span style={{ opacity: 0.5 }}>- Sin Concepto -</span>}
                                                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>ID: {t.ctactecod}</div>
                                                    </td>
                                                    <td>{new Date(t.Fecha).toLocaleDateString()}</td>
                                                    <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                                                        ${formatCurrency(t.Importe)}
                                                    </td>
                                                    <td style={{ color: '#fbbf24' }}>{t.BoletoPago || '-'}</td>
                                                    <td>
                                                        {t.EstadoBoleto ? (
                                                            <span className={`status-pill ${t.EstadoBoleto}`} title={t.EstadoBoleto === 'E' ? 'Emitido' : (t.EstadoBoleto === 'P' ? 'Pagado' : 'Anulado')}>
                                                                {t.EstadoBoleto}
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot style={{ background: 'rgba(0,0,0,0.4)', fontWeight: 'bold' }}>
                                            <tr>
                                                <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL PERIODO (P):</td>
                                                <td style={{ color: '#10b981', fontSize: '1rem' }}>
                                                    ${formatCurrency(pgTicketHistory.reduce((acc, t) => acc + parseFloat(t.Importe || 0), 0))}
                                                </td>
                                                <td colSpan={2}>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 'normal' }}>
                                                        E: Emitido | P: Pagado | A: Anulado
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                                    <p>No se encontraron registros de este período en las tablas de Postgres.</p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ background: 'var(--surface)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowPgTicketsModal(false)} className="btn btn-pdf" style={{ background: 'var(--primary)' }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CuentaCorrienteFn;
