import apiClient from './index';

export const login = async (username, password) => {
  const response = await apiClient.post('/api/auth/login', { username, password });
  return response.data; // Возвращаем ответ от сервера, например { token: "..." }
};

export const register = async (username, password) => {
  const response = await apiClient.post('/api/auth/register', { username, password });
  return response.data;
};