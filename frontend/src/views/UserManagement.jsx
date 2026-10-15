import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const UserManagement = ({ user: currentUserProp }) => {
    const [users, setUsers] = useState([]);
    const [nombre_usuario, setNombreUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [rol, setRol] = useState('conversor');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Edit state
    const [editingUserId, setEditingUserId] = useState(null);
    const [editPassword, setEditPassword] = useState('');
    const [editRol, setEditRol] = useState('');

    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        // Prefer the prop passed from App (already authenticated), fallback to localStorage
        if (currentUserProp) {
            setCurrentUser(currentUserProp);
        } else {
            const userStr = localStorage.getItem('nomade_user');
            if (userStr) {
                try { setCurrentUser(JSON.parse(userStr)); } catch(e){}
            }
        }
        fetchUsers();
    }, [currentUserProp]);

    const fetchUsers = async () => {
        try {
            const response = await axios.get(`${API_URL}/auth/users`);
            setUsers(response.data);
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await axios.post(`${API_URL}/auth/users`, { nombre_usuario, password, rol });
            setMessage({ type: 'success', text: 'Usuario creado con éxito' });
            setNombreUsuario('');
            setPassword('');
            setRol('conversor');
            fetchUsers();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Error al crear usuario' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este usuario?')) return;

        try {
            await axios.delete(`${API_URL}/auth/users/${id}`);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al eliminar usuario');
        }
    };

    const handleSaveEdit = async (id) => {
        setLoading(true);
        try {
            await axios.put(`${API_URL}/auth/users/${id}`, {
                password: editPassword || undefined,
                rol: editRol
            });
            setEditingUserId(null);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al actualizar usuario');
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = currentUser?.rol === 'admin' || currentUser?.rol === 'superadmin';
    const isConversorEditar = currentUser?.rol === 'conversor_editar';
    const canAccess = isAdmin || isConversorEditar;

    if (!canAccess) {
        return <div className="body-content"><h1>Acceso denegado</h1></div>;
    }

    // conversor_editar solo ve usuarios con rol 'conversor'
    const visibleUsers = isConversorEditar
        ? users.filter(u => u.rol === 'conversor')
        : users;

    return (
        <div className="body-content" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
            <h1>Gestión de Usuarios</h1>

            {/* Formulario de creación — admin completo, conversor_editar solo puede crear rol 'conversor' */}
            {(isAdmin || isConversorEditar) && (
                <div className="user-form-card">
                    <h2>Agregar Nuevo Usuario</h2>
                    {isConversorEditar && (
                        <p style={{ fontSize: '0.82rem', opacity: 0.6, marginBottom: '0.5rem' }}>
                            Solo podés crear usuarios con acceso al Conversor (rol: conversor).
                        </p>
                    )}
                    <form onSubmit={handleCreateUser} className="login-form" style={{ marginTop: '1.5rem' }}>
                        <div className="form-group">
                            <label>Nombre de Usuario</label>
                            <input
                                type="text"
                                className="input-field"
                                value={nombre_usuario}
                                onChange={(e) => setNombreUsuario(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                className="input-field"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Rol</label>
                            {isConversorEditar ? (
                                /* conversor_editar: rol fijo, no puede cambiarlo */
                                <input
                                    className="input-field"
                                    value="Conversor (solo lectura)"
                                    readOnly
                                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                />
                            ) : (
                                <select
                                    className="input-field"
                                    value={rol}
                                    onChange={(e) => setRol(e.target.value)}
                                >
                                    <option value="conversor">Conversor (solo lectura)</option>
                                    <option value="conversor_admin">Conversor Admin (edición)</option>
                                    <option value="conversor_editar">Conversor Editar (edición + usuarios)</option>
                                    <option value="admin">Administrador</option>
                                    <option value="superadmin">Super Administrador</option>
                                </select>
                            )}
                        </div>

                        {message.text && (
                            <div className={message.type === 'success' ? 'success-msg' : 'login-error'}>
                                {message.text}
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                            {loading ? 'Creando...' : 'Crear Usuario'}
                        </button>
                    </form>
                </div>
            )}

            <div className="users-list-card">
                <h2>
                    {isConversorEditar
                        ? 'Usuarios del Conversor'
                        : isAdmin ? 'Usuarios Existentes' : 'Mi Perfil de Usuario'}
                </h2>
                <table className="user-table">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Rol</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleUsers.map(u => (
                            <tr key={u.id}>
                                <td>{u.nombre_usuario}</td>
                                <td>
                                    {editingUserId === u.id ? (
                                        <select
                                            className="input-field"
                                            value={editRol}
                                            onChange={(e) => setEditRol(e.target.value)}
                                            disabled={!isAdmin}
                                            style={{ padding: '0.2rem', minHeight: 'auto', opacity: !isAdmin ? 0.6 : 1 }}
                                        >
                                            <option value="conversor">Conversor (solo lectura)</option>
                                            <option value="conversor_admin">Conversor Admin (edición)</option>
                                            <option value="conversor_editar">Conversor Editar (edición + usuarios)</option>
                                            <option value="admin">Administrador</option>
                                            <option value="superadmin">Super Administrador</option>
                                        </select>
                                    ) : (
                                        <span className={`role-badge ${u.rol}`}>
                                            {u.rol}
                                        </span>
                                    )}
                                    {editingUserId === u.id && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <input
                                                type="password"
                                                placeholder="Nueva clave"
                                                className="input-field"
                                                value={editPassword}
                                                onChange={(e) => setEditPassword(e.target.value)}
                                                style={{ padding: '0.2rem', minHeight: 'auto', fontSize: '0.8rem' }}
                                            />
                                            {!isAdmin && <small style={{ display: 'block', fontSize: '0.65rem', color: 'orange' }}>Solo edición de contraseña permitida</small>}
                                        </div>
                                    )}
                                </td>
                                <td>
                                    {editingUserId === u.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleSaveEdit(u.id)} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} disabled={loading}>Guardar</button>
                                            <button onClick={() => setEditingUserId(null)} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Cancelar</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {/* conversor_editar NO puede editar ni eliminar, solo crear */}
                                            {(isAdmin || u.id === currentUser?.id) && (
                                                <button
                                                    onClick={() => { setEditingUserId(u.id); setEditRol(u.rol); setEditPassword(''); }}
                                                    className="btn btn-primary"
                                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#3b82f6', borderColor: '#3b82f6' }}
                                                >
                                                    Editar
                                                </button>
                                            )}
                                            {(isAdmin || u.id === currentUser?.id) && (
                                                <button
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    className="delete-btn"
                                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                                >
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagement;
