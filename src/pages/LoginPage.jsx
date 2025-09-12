import React, { useState } from 'react';
import { login, register } from '../api/authApi';
import './LoginPage.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await login(username, password);
      localStorage.setItem('token', data.token);
      window.location.href = '/chat';
    } catch (err) {
      setError(err.response?.data?.message || 'Произошла ошибка при входе');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await register(username, password, displayName);
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Произошла ошибка при регистрации');
    }
  };

  return (
    <div className="login-container">
      <h1>Вход или Регистрация</h1>
      <form className="login-form">
        <div className="form-group">
          <label htmlFor="username">Логин:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Пароль:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="displayName">Отображаемое имя (при регистрации):</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Например: Иван"
          />
        </div>
        <div className="form-actions">
          <button type="button" onClick={handleLogin}>Войти</button>
          <button type="button" onClick={handleRegister}>Регистрация</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
    </div>
  );
}

export default LoginPage;