import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create();

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  config.baseURL = API_URL;
  return config;
});

const get = (url, config) => apiClient.get(url, config);
const post = (url, data, config) => apiClient.post(url, data, config);

export { get, post }; 