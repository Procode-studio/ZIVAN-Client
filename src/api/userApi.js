import { get } from './index';

export const searchUsers = async (username) => {
  const response = await get(`/api/users/search?username=${username}`); 
  return response.data;
};