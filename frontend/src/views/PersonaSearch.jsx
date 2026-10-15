import React, { useState } from 'react';
import { 
    Search, User, Mail, Phone, Fingerprint, CreditCard, Loader2, 
    X, MapPin, CalendarDays, PhoneCall, ShieldCheck, Info, Briefcase, UserCircle
} from 'lucide-react';
import { API_URL } from '../config';

const PersonaSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('nomade_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (query.trim().length < 2) return;

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/infogov/search-persona?q=${encodeURIComponent(query)}`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('Error al buscar personas');
            const data = await response.json();
            setResults(data);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (person) => {
        setSelectedPerson(person);
        setShowModal(true);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('es-AR');
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="body-content">
            <div className="welcome-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '0.5rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '0.5rem' }}>
                        <User size={24} color="#2563eb" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Buscar Persona (InfoGov)</h1>
                </div>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search 
                            size={18} 
                            style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} 
                        />
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Nombre, CUIT o Documento..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{ paddingLeft: '3rem' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Buscar'}
                    </button>
                </form>

                {error && (
                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.5rem', color: '#ef4444', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                <div className="results-container">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <Loader2 className="animate-spin" size={32} color="#2563eb" style={{ margin: '0 auto' }} />
                            <p style={{ marginTop: '1rem', color: 'var(--text-dim)' }}>Buscando en infogov.persona...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                            {results.map((person) => (
                                <div key={person.CucuPers} className="data-card" style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>
                                            {person.DetaPers}
                                        </h3>
                                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--border)', borderRadius: '1rem' }}>
                                            ID: {person.CucuPers}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                            <Fingerprint size={14} color="#2563eb" />
                                            <span style={{ color: 'var(--text-dim)' }}>DNI:</span> {person.NudoPers}
                                        </div>
                                        {person.CuitPers && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                <CreditCard size={14} color="#10b981" />
                                                <span style={{ color: 'var(--text-dim)' }}>CUIT:</span> {person.CuitPers}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex' }}>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem' }}
                                            onClick={() => handleViewDetails(person)}
                                        >
                                            Ver Detalles Completos
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : query.length >= 2 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--glass)', borderRadius: '1rem' }}>
                            <Search size={32} color="var(--text-dim)" style={{ margin: '0 auto', opacity: 0.2 }} />
                            <p style={{ marginTop: '1rem', color: 'var(--text-dim)' }}>No se encontraron personas con "{query}"</p>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: '1rem' }}>
                            <p style={{ color: 'var(--text-dim)' }}>Ingresa al menos 2 caracteres para buscar</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Detalles */}
            {showModal && selectedPerson && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '1rem',
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{
                        backgroundColor: 'var(--card)',
                        width: '100%',
                        maxWidth: '800px',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        position: 'relative',
                        maxHeight: '95vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.5rem 2rem',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'linear-gradient(90deg, rgba(37,99,235,0.05) 0%, transparent 100%)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ 
                                    width: '45px', height: '45px', borderRadius: '12px', 
                                    background: 'var(--primary)', display: 'flex', 
                                    alignItems: 'center', justifyContent: 'center', color: 'white' 
                                }}>
                                    <User size={24} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{selectedPerson.DetaPers}</h2>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>ID Interno: {selectedPerson.CucuPers}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowModal(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.5rem' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body - Form Layout */}
                        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                            <div className="person-modal-grid">
                                
                                {/* Section: Datos Personales */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <UserCircle size={18} /> Datos Identificatorios
                                    </h3>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                        <div className="form-item">
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Documento / CUIT</label>
                                            <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                <Fingerprint size={16} color="#2563eb" />
                                                <span style={{ fontWeight: 600 }}>{selectedPerson.NudoPers}</span>
                                                <span style={{ opacity: 0.3 }}>|</span>
                                                <span style={{ fontWeight: 600 }}>{selectedPerson.CuitPers || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                                            <div className="form-item">
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Fecha Nacimiento</label>
                                                <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <CalendarDays size={16} color="#f59e0b" />
                                                    <span>{formatDate(selectedPerson.FenaPers)}</span>
                                                </div>
                                            </div>
                                            <div className="form-item">
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Género / Tipo</label>
                                                <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <Info size={16} color="#10b981" />
                                                    <span>{selectedPerson.SexoPers === 1 ? 'Masc' : selectedPerson.SexoPers === 2 ? 'Fem' : 'N/A'}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({selectedPerson.JuriPers === 1 ? 'Física' : 'Jurídica'})</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 style={{ margin: '1rem 0 0 0', fontSize: '0.9rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <PhoneCall size={18} /> Contacto
                                    </h3>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                        <div className="form-item">
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Email Principal</label>
                                            <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Mail size={16} color="#ec4899" />
                                                <span style={{ wordBreak: 'break-all' }}>{selectedPerson.MailPers || 'No registrado'}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                                            <div className="form-item">
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Teléfono Fijo</label>
                                                <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <Phone size={16} color="#6366f1" />
                                                    <span>{selectedPerson.TelePers || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="form-item">
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Celular</label>
                                                <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <Phone size={16} color="#8b5cf6" />
                                                    <span>{selectedPerson.CeluPers || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Domicilio */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <MapPin size={18} /> Domicilio Real
                                    </h3>

                                    <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div className="form-item">
                                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>Calle y Nro</label>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                                                {selectedPerson.DecrPers || 'N/A'} {selectedPerson.NurePers || ''}
                                            </div>
                                        </div>
                                        <div className="form-item">
                                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>Barrio / Localidad</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <ShieldCheck size={14} color="#10b981" />
                                                <span>{selectedPerson.DebrPers || 'N/A'}</span>
                                            </div>
                                        </div>
                                        {selectedPerson.UbrePers && (
                                            <div className="form-item" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(37,99,235,0.05)', borderRadius: '8px', fontSize: '0.8rem' }}>
                                                <strong>Ref:</strong> {selectedPerson.UbrePers}
                                            </div>
                                        )}
                                    </div>

                                    <h3 style={{ margin: '1rem 0 0 0', fontSize: '0.9rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Briefcase size={18} /> Información de Registro
                                    </h3>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                        <div className="form-item">
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Observaciones</label>
                                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', minHeight: '80px', fontSize: '0.85rem' }}>
                                                {selectedPerson.ObsePers || 'Sin observaciones registradas.'}
                                            </div>
                                        </div>
                                        <div className="form-item">
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>Fecha de Alta en Sistema</label>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                                                Registrado el {formatDate(selectedPerson.AltaFeho)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setShowModal(false)}
                            >
                                Cerrar
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => window.print()}
                            >
                                Imprimir Ficha
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .person-modal-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;
                }

                @media (max-width: 768px) {
                    .person-modal-grid {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                    }

                    .welcome-card {
                        padding: 1.5rem !important;
                    }

                    h1 {
                        font-size: 1.25rem !important;
                    }

                    form {
                        flex-direction: column;
                    }

                    .btn {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
};

export default PersonaSearch;
