import axios from 'axios';

// Базовый URL теперь просто переменная
const API_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create(); // Создаем клиент без baseURL

// Перехватчик для токена остается без изменений
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['x-auth-token'] = token;
  }
  return config;
});

// --- НОВАЯ ФУНКЦИЯ-ПОМОЩНИК ---
// Она будет добавлять базовый URL к каждому запросу
const get = (url, config) => apiClient.get(`${API_URL}${url}`, config);
const post = (url, data, config) => apiClient.post(`${API_URL}${url}`, data, config);
// Можно добавить put, delete и т.д., если понадобятся

export { get, post }; 