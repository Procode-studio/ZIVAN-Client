import React from 'react';
import { Navigate } from 'react-router-dom';

function Root() {
  const token = localStorage.getItem('token');

  // Если токен есть, перенаправляем в чат.
  // Если токена нет, перенаправляем на страницу входа.
  return token ? <Navigate to="/chat" /> : <Navigate to="/login" />;
}

export default Root;