import React, { useState } from 'react';
import { FileUp, FileSpreadsheet, Download, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import API_BASE_URL from '../config';

const ComerciosExcel = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleProcessLocal = async () => {
        setLoading(true);
        setError(null);
        setSuccess(false);
        try {
            const response = await fetch(`${API_BASE_URL}/api/excel/parse-comercios`, {
                method: 'POST'
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        setError(null);
        setSuccess(false);
        try {
            const response = await fetch(`${API_BASE_URL}/api/excel/parse-comercios`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!data) return;
        
        const sanitize = (val) => {
            if (val === null || val === undefined) return '';
            let s = String(val).replace(/\r?\n/g, " ");
            if (s.includes(';') || s.includes('"')) {
                s = `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        const headers = data.headers.map(sanitize).join(';');
        const rows = data.rows.map(row => row.map(sanitize).join(';')).join('\n');
        const csvContent = "\uFEFF" + headers + '\n' + rows;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'comercios_habilitados_unmerged.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="body-content">
            <div className="welcome-card" style={{ maxWidth: '1000px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Herramienta Excel a CSV - Comercios</h1>
                        <p>Parsea el archivo de habilitaciones detectando y expandiendo celdas combinadas.</p>
                    </div>
                </div>

                <div className="excel-controls" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-pdf" onClick={handleProcessLocal} disabled={loading} style={{ background: '#2563eb' }}>
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        Procesar Archivo Local (C:\nomade\...)
                    </button>

                    <div className="file-input-wrapper">
                        <label className="btn btn-pdf" style={{ background: 'var(--primary)', cursor: 'pointer' }}>
                            <FileUp size={18} />
                            Subir otro Excel
                            <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" style={{ display: 'none' }} />
                        </label>
                    </div>

                    {data && (
                        <button className="btn btn-pdf" onClick={exportToCSV} style={{ background: '#10b981' }}>
                            <Download size={18} />
                            Exportar a CSV
                        </button>
                    )}
                </div>

                {error && <div className="error-msg"><AlertCircle size={18} /> {error}</div>}
                {success && <div className="success-msg" style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={18} /> Archivo procesado con éxito. Se expandieron las filas combinadas.
                </div>}

                {data && (
                    <div className="table-container" style={{ background: 'var(--glass)', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '600px' }}>
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    {data.headers.map((h, i) => <th key={i}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.slice(0, 50).map((row, i) => (
                                    <tr key={i}>
                                        {row.map((cell, j) => <td key={j}>{cell}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {data.rows.length > 50 && (
                            <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.6 }}>
                                Mostrando las primeras 50 de {data.rows.length} filas... Descarga el CSV para ver el total.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .success-msg { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default ComerciosExcel;
