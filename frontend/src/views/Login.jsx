import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const Login = ({ onLogin }) => {
  const [nombre_usuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        nombre_usuario,
        password
      });

      const { token, user } = response.data;
      localStorage.setItem('nomade_token', token);
      localStorage.setItem('nomade_user', JSON.stringify(user));

      // Set default auth header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      onLogin(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/Logo-Nomade.svg" alt="Nomade Logo" style={{ width: '200px', marginBottom: '1.5rem' }} />
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={nombre_usuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              placeholder="Ingrese su usuario"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Entrar'}
          </button>
        </form>

        <div className="login-footer">
          © 2026 Migration Tool
        </div>
      </div>
    </div>
  );
};

export default Login;
