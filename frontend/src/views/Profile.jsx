import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const Profile = ({ user }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
            return;
        }

        setLoading(true);
        try {
            await axios.put(`${API_URL}/auth/change-password`, {
                currentPassword,
                newPassword
            });
            setMessage({ type: 'success', text: 'Contraseña actualizada con éxito' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Error al actualizar contraseña' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="body-content" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
            <h1>Mi Perfil</h1>
            <p style={{ marginBottom: '2rem' }}>Usuario: <strong style={{ color: 'var(--primary)' }}>{user?.nombre_usuario}</strong></p>

            <div className="user-form-card">
                <h2>Cambiar Contraseña</h2>
                <form onSubmit={handleChangePassword} className="login-form" style={{ marginTop: '1.5rem' }}>
                    <div className="form-group">
                        <label>Contraseña Actual</label>
                        <input 
                            type="password" 
                            className="input-field"
                            value={currentPassword} 
                            onChange={(e) => setCurrentPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Nueva Contraseña</label>
                        <input 
                            type="password" 
                            className="input-field"
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirmar Nueva Contraseña</label>
                        <input 
                            type="password" 
                            className="input-field"
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                        />
                    </div>

                    {message.text && (
                        <div className={message.type === 'success' ? 'success-msg' : 'login-error'}>
                            {message.text}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
                    </button>
                </form>
            </div>
            
            <style jsx>{`
                .success-msg {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    color: #6ee7b7;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    margin-bottom: 1.5rem;
                    text-align: center;
                }
            `}</style>
        </div>
    );
};

export default Profile;
