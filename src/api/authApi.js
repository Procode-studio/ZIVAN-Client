import { post } from './index';

export const login = async (username, password) => {
  const response = await post('/api/auth/login', { login: username, password });
  return response.data;
};

export const register = async (username, password, displayName) => {
  const payload = { login: username, password };
  if (displayName && displayName.trim()) payload.displayName = displayName.trim();
  const response = await post('/api/auth/register', payload);
  return response.data;
};