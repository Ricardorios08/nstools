import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import {
  Upload, FileText, Download, AlertCircle, CheckCircle2,
  Loader2, X, Table2, RefreshCw, FileSpreadsheet, Search, Check, ChevronDown, Sparkles, Eye, Copy
} from 'lucide-react';

const COLS = ['fecha', 'referencia', 'codMov', 'descripcion', 'importe', 'saldo'];
const COL_LABELS = {
  fecha: 'Fecha',
  referencia: 'Referencia',
  codMov: 'Tipo',
  descripcion: 'Descripción',
  importe: 'Importe',
  saldo: 'Saldo'
};

export default function ConversorBancario({ user }) {
  // conversor_admin, conversor_editar, superadmin y municipalidad pueden editar; conversor solo lee
  const canEdit = user?.rol === 'conversor_admin' || user?.rol === 'conversor_editar' || user?.rol === 'superadmin' || user?.rol === 'admin';
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null); // { tipo, nombreArchivo, totalFilas, filas }
  const [filas, setFilas] = useState([]);           // filas editables
  const [opciones, setOpciones] = useState({ sucursal: '', cuenta: '', numHoja: '' });
  const [descargando, setDescargando] = useState(false);
  const fileInputRef = useRef();

  // Searchable Select Cuentas state
  const [cuentas, setCuentas] = useState([]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [autoDetectedMsg, setAutoDetectedMsg] = useState(null);
  const dropdownRef = useRef(null);

  // Visor de vista previa state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewRefLength, setPreviewRefLength] = useState(8);

  // Drag del modal
  const [modalPos, setModalPos] = useState(null); // null = centrado, { x, y } = posición fija
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef(null);

  const onModalMouseDown = (e) => {
    if (e.button !== 0) return;
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e) => {
      setModalPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  // Cargar cuentas bancarias
  useEffect(() => {
    axios.get(`${API_URL}/conversor/cuentas`)
      .then(res => {
        setCuentas(res.data || []);
      })
      .catch(err => {
        console.error('Error al cargar cuentas bancarias:', err);
      });
  }, []);

  // Manejo de click outside para cerrar dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const procesarArchivo = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    
    const filesArray = Array.from(files);
    const invalidFile = filesArray.find(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return !['xlsx', 'xls', 'pdf'].includes(ext);
    });

    if (invalidFile) {
      setError('Solo se aceptan archivos .xlsx, .xls o .pdf');
      return;
    }

    setLoading(true);
    setError(null);
    setResultado(null);
    setFilas([]);
    setAutoDetectedMsg(null);

    const formData = new FormData();
    filesArray.forEach(file => {
      formData.append('archivo', file);
    });

    try {
      const res = await axios.post(`${API_URL}/conversor/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResultado(res.data);
      setFilas(res.data.filas);

      // Auto-detección de cuenta
      if (res.data.cuentaDetectada) {
        const ctaDetectada = String(res.data.cuentaDetectada).trim();
        const coincidencia = cuentas.find(c => 
          String(c.cuenta).endsWith(ctaDetectada) || ctaDetectada.endsWith(String(c.cuenta))
        );

        if (coincidencia) {
          setCuentaSeleccionada(coincidencia);
          setOpciones(prev => ({ ...prev, sucursal: coincidencia.sucursal, cuenta: coincidencia.cuenta }));
          setSearchQuery(`[Banco ${coincidencia.numBanco}] ${coincidencia.nombre} (Cta: ${coincidencia.cuenta})`);
          setAutoDetectedMsg(`Cuenta auto-detectada: [Banco ${coincidencia.numBanco}] ${coincidencia.nombre} - ${coincidencia.denominacion}`);
        } else {
          setOpciones(prev => ({ ...prev, cuenta: ctaDetectada }));
          setAutoDetectedMsg(`Número de cuenta detectado en archivo: ${ctaDetectada} (no está en la tabla de cuentas)`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  }, [cuentas]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    procesarArchivo(e.dataTransfer.files);
  }, [procesarArchivo]);

  const onFileChange = (e) => {
    procesarArchivo(e.target.files);
    e.target.value = '';
  };


  const editarFila = (idx, campo, valor) => {
    setFilas(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };
      return copia;
    });
  };

  const eliminarFila = (idx) => {
    setFilas(prev => prev.filter((_, i) => i !== idx));
  };

  const descargar = async (refLength = 8) => {
    setDescargando(true);
    try {
      const opcionesConRef = { ...opciones, refLength };
      const res = await axios.post(
        `${API_URL}/conversor/export`,
        { filas, opciones: opcionesConRef, nombreBase: resultado?.nombreArchivo || 'extracto' },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }));
      const a = document.createElement('a');
      const suffix = refLength === 15 ? '_convertido_ref15.txt' : '_convertido_ref8.txt';
      const nombre = (resultado?.nombreArchivo || 'extracto').replace(/\.[^.]+$/, '') + suffix;
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error al generar el archivo: ' + (err.response?.data?.error || err.message));
    } finally {
      setDescargando(false);
    }
  };

  const resetear = () => {
    setResultado(null);
    setFilas([]);
    setError(null);
    setOpciones({ sucursal: '', cuenta: '', numHoja: '' });
    setCuentaSeleccionada(null);
    setSearchQuery('');
    setAutoDetectedMsg(null);
  };

  const cerrarModal = () => {
    setPreviewOpen(false);
    setModalPos(null);
  };

  const verVistaPrevia = async (refLength = 8) => {
    setPreviewRefLength(refLength);
    setPreviewLoading(true);
    setError(null);
    try {
      const opcionesConRef = { ...opciones, refLength };
      const res = await axios.post(
        `${API_URL}/conversor/export`,
        { filas, opciones: opcionesConRef, nombreBase: resultado?.nombreArchivo || 'extracto' },
        { responseType: 'text' }
      );
      setPreviewText(res.data);
      setPreviewOpen(true);
    } catch (err) {
      setError('Error al generar la vista previa: ' + (err.response?.data?.error || err.message));
    } finally {
      setPreviewLoading(false);
    }
  };

  const copiarTexto = () => {
    navigator.clipboard.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalDebe = filas.filter(f => f.codMov === 'D').reduce((s, f) => s + (parseFloat(String(f.importe).replace(',', '.')) || 0), 0);
  const totalHaber = filas.filter(f => f.codMov === 'H').reduce((s, f) => s + (parseFloat(String(f.importe).replace(',', '.')) || 0), 0);

  return (
    <div className="conversor-view" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <FileSpreadsheet size={26} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          Conversor de Extractos Bancarios
        </h1>
        <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>
          Cargá un extracto bancario (Excel o PDF) y obtené el archivo en formato estándar financiero.
        </p>
      </div>

      {/* Opciones globales */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.2rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        position: 'relative'
      }}>
        {/* Selector de Cuentas */}
        <div ref={dropdownRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', position: 'relative', width: '350px' }}>
          <label style={{ fontSize: '0.78rem', opacity: 0.7, fontWeight: 600 }}>Banco / Cuenta (Buscador)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar banco, cuenta o denominación..."
              value={searchQuery}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              style={{
                padding: '0.5rem 2rem 0.5rem 2rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.88rem',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
            {(searchQuery || cuentaSeleccionada) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCuentaSeleccionada(null);
                  setOpciones(p => ({ ...p, sucursal: '', cuenta: '' }));
                  setAutoDetectedMsg(null);
                }}
                style={{
                  position: 'absolute',
                  right: '0.7rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text)',
                  opacity: 0.5,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              marginTop: '4px',
              maxHeight: '220px',
              overflowY: 'auto',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
            }}>
              {(() => {
                const s = searchQuery.toLowerCase().trim();
                const filteredCuentas = cuentas.filter(c => {
                  if (!s || s === (cuentaSeleccionada ? `[banco ${cuentaSeleccionada.numBanco}] ${cuentaSeleccionada.nombre} (cta: ${cuentaSeleccionada.cuenta})`.toLowerCase().trim() : '')) {
                    return true;
                  }
                  return (
                    (c.nombre || '').toLowerCase().includes(s) ||
                    (c.numBanco || '').toLowerCase().includes(s) ||
                    (c.cuenta || '').toLowerCase().includes(s) ||
                    (c.denominacion || '').toLowerCase().includes(s) ||
                    (c.sucursal || '').toLowerCase().includes(s) ||
                    (c.categoria || '').toLowerCase().includes(s)
                  );
                });

                if (filteredCuentas.length === 0) {
                  return (
                    <div style={{ padding: '0.8rem', fontSize: '0.82rem', opacity: 0.5, textAlign: 'center' }}>
                      No se encontraron cuentas
                    </div>
                  );
                }

                return filteredCuentas.map((c) => (
                  <div
                    key={c.cuenta}
                    onClick={() => {
                      setCuentaSeleccionada(c);
                      setOpciones(p => ({ ...p, sucursal: c.sucursal, cuenta: c.cuenta }));
                      setSearchQuery(`[Banco ${c.numBanco}] ${c.nombre} (Cta: ${c.cuenta})`);
                      setDropdownOpen(false);
                      setAutoDetectedMsg(null);
                    }}
                    style={{
                      padding: '0.6rem 0.8rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: cuentaSeleccionada?.cuenta === c.cuenta ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>[{c.numBanco}] {c.nombre}</span>
                      <span style={{ fontSize: '0.72rem', opacity: 0.5, background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>
                        Suc: {c.sucursal}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.15rem' }}>
                      {c.denominacion}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>Cta: {c.cuenta}</span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.5 }}>•</span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.5 }}>{c.categoria}</span>
                      {!c.activa && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                          Inactiva
                        </span>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Inputs */}
        {[
          ['sucursal', 'Sucursal', '100px'],
          ['cuenta', 'Cuenta', '150px'],
          ['numHoja', 'N° Hoja', '80px']
        ].map(([key, label, width]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.78rem', opacity: 0.7, fontWeight: 600 }}>{label} {key !== 'numHoja' && '*'}</label>
            <input
              value={opciones[key]}
              onChange={e => {
                setOpciones(p => ({ ...p, [key]: e.target.value }));
                if (key === 'cuenta' || key === 'sucursal') {
                  setCuentaSeleccionada(null);
                  setAutoDetectedMsg(null);
                }
              }}
              placeholder={label}
              style={{
                padding: '0.5rem 0.8rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.88rem',
                width: width
              }}
            />
          </div>
        ))}

        {/* Mensaje de auto-detección */}
        {autoDetectedMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.8rem',
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '8px',
            color: '#818cf8',
            fontSize: '0.8rem',
            fontWeight: 500,
            marginLeft: 'auto'
          }}>
            <Sparkles size={14} style={{ color: '#a5b4fc', flexShrink: 0 }} />
            <span>{autoDetectedMsg}</span>
          </div>
        )}
      </div>


      {/* Dropzone */}
      {!resultado && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: '16px',
            padding: '4rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(37, 99, 235, 0.05)' : 'var(--surface)',
            transition: 'all 0.2s',
            marginBottom: '1.5rem'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf"
            multiple
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <Loader2 size={40} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <span style={{ opacity: 0.7 }}>Procesando archivos...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <Upload size={44} style={{ color: 'var(--accent)', opacity: 0.8 }} />
              <div>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  {dragging ? 'Soltá los archivos aquí' : 'Arrastrá uno o más archivos o hacé clic para seleccionar'}
                </p>
                <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Excel (.xlsx, .xls) o PDF — Se combinarán y ordenarán cronológicamente</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px',
          padding: '1rem 1.2rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.7rem',
          color: '#f87171'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '0.9rem' }}>{error}</span>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <>
          {/* Barra de info + acciones */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem 1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{resultado.nombreArchivo}</span>
                <span style={{
                  background: resultado.tipo === 'PDF' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                  color: resultado.tipo === 'PDF' ? '#f87171' : '#4ade80',
                  fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px'
                }}>{resultado.tipo}</span>
              </div>
              <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{filas.length} movimiento{filas.length !== 1 ? 's' : ''}</span>
              <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                Débitos: <strong style={{ color: '#f87171' }}>{totalDebe.toFixed(2).replace('.', ',')}</strong>
                {' | '}
                Créditos: <strong style={{ color: '#4ade80' }}>{totalHaber.toFixed(2).replace('.', ',')}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.7rem' }}>
              <button
                onClick={resetear}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 1rem', borderRadius: '8px',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                <RefreshCw size={15} /> Nuevo archivo
              </button>

              {/* Vistas Previas */}
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => verVistaPrevia(8)}
                  disabled={previewLoading || filas.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.5rem 0.8rem', background: 'var(--surface)', border: 'none',
                    borderRight: '1px solid var(--border)',
                    color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem',
                    opacity: previewLoading || filas.length === 0 ? 0.6 : 1
                  }}
                >
                  <Eye size={13} /> Vista Previa (Ref 8)
                </button>
                <button
                  type="button"
                  onClick={() => verVistaPrevia(15)}
                  disabled={previewLoading || filas.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.5rem 0.8rem', background: 'var(--surface)', border: 'none',
                    color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem',
                    opacity: previewLoading || filas.length === 0 ? 0.6 : 1
                  }}
                >
                  <Eye size={13} /> Vista Previa (Ref 15)
                </button>
              </div>

              {/* Descargas */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => descargar(8)}
                  disabled={descargando || filas.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 1rem', borderRadius: '8px',
                    background: 'transparent', border: '1px solid var(--primary)',
                    color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    opacity: descargando || filas.length === 0 ? 0.6 : 1
                  }}
                >
                  <Download size={14} /> Descargar (Ref 8)
                </button>
                <button
                  type="button"
                  onClick={() => descargar(15)}
                  disabled={descargando || filas.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 1.1rem', borderRadius: '8px',
                    background: 'var(--primary)', border: 'none',
                    color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    opacity: descargando || filas.length === 0 ? 0.6 : 1
                  }}
                >
                  <Download size={14} /> Descargar (Ref 15)
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de filas */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: 'var(--bg)' }}>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'left', opacity: 0.6, fontWeight: 600, whiteSpace: 'nowrap' }}>#</th>
                    {COLS.map(c => (
                      <th key={c} style={{ padding: '0.7rem 1rem', textAlign: 'left', opacity: 0.6, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {COL_LABELS[c]}
                      </th>
                    ))}
                    {canEdit && <th style={{ padding: '0.7rem 0.5rem', width: '40px' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <td style={{ padding: '0.5rem 1rem', opacity: 0.4, fontFamily: 'monospace' }}>{idx + 1}</td>
                      {COLS.map(campo => (
                        <td key={campo} style={{ padding: '0.4rem 0.5rem' }}>
                          {campo === 'codMov' ? (
                            canEdit ? (
                              <select
                                value={fila[campo]}
                                onChange={e => editarFila(idx, campo, e.target.value)}
                                style={{
                                  padding: '0.25rem 0.4rem', borderRadius: '6px',
                                  background: fila[campo] === 'D' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                  border: '1px solid var(--border)',
                                  color: fila[campo] === 'D' ? '#f87171' : '#4ade80',
                                  fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                <option value="D">D - Débito</option>
                                <option value="H">H - Haber</option>
                              </select>
                            ) : (
                              <span style={{
                                padding: '0.25rem 0.6rem', borderRadius: '6px', display: 'inline-block',
                                background: fila[campo] === 'D' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                color: fila[campo] === 'D' ? '#f87171' : '#4ade80',
                                fontSize: '0.82rem', fontWeight: 700
                              }}>
                                {fila[campo] === 'D' ? 'D - Débito' : 'H - Haber'}
                              </span>
                            )
                          ) : (
                            canEdit ? (
                              <input
                                value={fila[campo] || ''}
                                onChange={e => editarFila(idx, campo, e.target.value)}
                                style={{
                                  padding: '0.25rem 0.5rem', borderRadius: '6px',
                                  background: 'transparent', border: '1px solid transparent',
                                  color: 'var(--text)', fontSize: '0.82rem',
                                  width: campo === 'descripcion' ? '300px' : campo === 'importe' ? '100px' : '90px',
                                  transition: 'border-color 0.15s'
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                                onBlur={e => e.target.style.borderColor = 'transparent'}
                              />
                            ) : (
                              <span style={{
                                display: 'inline-block', padding: '0.25rem 0.5rem',
                                color: 'var(--text)', fontSize: '0.82rem',
                                width: campo === 'descripcion' ? '300px' : campo === 'importe' ? '100px' : '90px',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                              }}>
                                {fila[campo] || ''}
                              </span>
                            )
                          )}
                        </td>
                      ))}
                      {canEdit && (
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={() => eliminarFila(idx)}
                            title="Eliminar fila"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'rgba(239,68,68,0.5)', padding: '4px',
                              borderRadius: '4px', display: 'flex', alignItems: 'center'
                            }}
                            onMouseOver={e => e.currentTarget.style.color = '#f87171'}
                            onMouseOut={e => e.currentTarget.style.color = 'rgba(239,68,68,0.5)'}
                          >
                            <X size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Visor de Texto */}
      {previewOpen && (
        <div
          ref={modalRef}
          style={{
            position: 'fixed',
            ...(modalPos
              ? { top: modalPos.y, left: modalPos.x }
              : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            ),
            width: '90%',
            maxWidth: '950px',
            maxHeight: '85vh',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: modalPos ? 'none' : 'scaleIn 0.2s ease-out',
          }}>
            {/* Header - drag handle */}
            <div
              onMouseDown={onModalMouseDown}
              style={{
                padding: '1.2rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.01)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Vista Previa de Exportación</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={copiarTexto}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <Copy size={14} />
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={cerrarModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    opacity: 0.6,
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onMouseOver={e => e.currentTarget.style.opacity = 1}
                  onMouseOut={e => e.currentTarget.style.opacity = 0.6}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{
              padding: '1.5rem',
              overflowY: 'auto',
              background: '#090d16',
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              gap: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              lineHeight: '1.5'
            }}>
              {/* Números de renglón (No seleccionables) */}
              <div style={{
                textAlign: 'right',
                color: '#475569',
                userSelect: 'none',
                borderRight: '1px solid #1e293b',
                paddingRight: '0.8rem',
                minWidth: '2.5rem',
                opacity: 0.7
              }}>
                {previewText.split(/\r?\n/).map((_, idx) => (
                  <div key={idx} style={{ height: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{idx + 1}</div>
                ))}
              </div>
              
              {/* Contenido del texto */}
              <div style={{ flex: 1, overflowX: 'auto' }}>
                {previewText.split(/\r?\n/).map((line, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      height: '1.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      color: '#e2e8f0', 
                      whiteSpace: 'pre',
                      fontFamily: 'monospace'
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.7rem',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button
                onClick={cerrarModal}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  cerrarModal();
                  descargar(previewRefLength);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '8px',
                  background: 'var(--primary)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                <Download size={15} />
                Descargar (Ref {previewRefLength})
              </button>
            </div>
          </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
