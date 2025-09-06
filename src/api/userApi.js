import apiClient from './index';

export const searchUsers = async (username) => {
  const response = await apiClient.get(`/api/users/search?username=${username}`);
  return response.data;
};