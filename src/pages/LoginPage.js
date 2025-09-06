import React, { useState } from 'react';
import { login, register } from '../api/authApi'; // Импортируем наши API-функции

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault(); // Эта команда предотвращает перезагрузку страницы при клике на кнопку
    setError('');
    setMessage('');
    try {
      const data = await login(username, password);
      localStorage.setItem('token', data.token); // Сохраняем токен в хранилище браузера
      setMessage('Успешный вход! Скоро здесь будет переход на страницу чата.');
      // В будущем здесь будет window.location.href = '/chat';
    } catch (err) {
      // err.response.data.message - это сообщение об ошибке с нашего бэкенда
      setError(err.response?.data?.message || 'Произошла ошибка при входе');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await register(username, password);
      setMessage(data.message); // Показываем сообщение от бэкенда (например, "User registered successfully")
    } catch (err) {
      setError(err.response?.data?.message || 'Произошла ошибка при регистрации');
    }
  };

  return (
    <div>
      <h1>Вход или Регистрация</h1>
      <form>
        <div>
          <label>Имя пользователя:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label>Пароль:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button onClick={handleLogin}>Войти</button>
        <button onClick={handleRegister}>Регистрация</button>
      </form>
      {/* Блоки для отображения ошибок или сообщений об успехе */}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}
    </div>
  );
}

export default LoginPage;