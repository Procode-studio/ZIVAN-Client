import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import './App.css';

// Маленький компонент-помощник для защищенных роутов
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Если пользователь заходит на /login, показываем LoginPage */}
          <Route path="/login" element={<LoginPage />} />

          {/* Если пользователь заходит на /chat, используем PrivateRoute */}
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <ChatPage />
              </PrivateRoute>
            }
          />

          {/* Если пользователь заходит на главную страницу /, перенаправляем его */}
          <Route path="/" element={<Navigate to="/chat" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;