import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Trash2, RefreshCw, FileText, Download } from 'lucide-react';

const LogViewer = () => {
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/auth/logs`);
            setLogs(response.data.logs);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRotateLogs = async () => {
        if (!window.confirm('¿Está seguro de rotar los logs? Esto creará un respaldo y vaciará el log actual.')) return;
        
        try {
            await axios.post(`${API_URL}/auth/logs/rotate`);
            setMessage('Logs rotados y respaldados con éxito');
            fetchLogs();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            alert('Error al rotar logs');
        }
    };

    return (
        <div className="body-content" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1>Auditoría del Sistema</h1>
                    <p style={{ color: 'var(--text-dim)' }}>Registro histórico de acciones y seguridad</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={fetchLogs} className="btn btn-secondary" disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spin-icon' : ''} />
                        Actualizar
                    </button>
                    <button onClick={handleRotateLogs} className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                        <Trash2 size={18} />
                        Rotar Log (Backup)
                    </button>
                </div>
            </div>

            {message && (
                <div className="success-msg" style={{ marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px' }}>
                    {message}
                </div>
            )}

            <div className="logs-container" style={{ 
                background: '#0a0b10', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '1px solid var(--border)',
                fontFamily: 'Fira Code, monospace',
                fontSize: '0.85rem',
                color: '#94a3b8',
                whiteSpace: 'pre-wrap',
                minHeight: '400px',
                maxHeight: '600px',
                overflowY: 'auto'
            }}>
                {logs ? logs : 'No hay registros en el log actual.'}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                <FileText size={14} />
                <span>Ubicación del archivo: backend/logs/audit.log</span>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .spin-icon { animation: spin 2s linear infinite; }
            `}} />
        </div>
    );
};

export default LogViewer;
