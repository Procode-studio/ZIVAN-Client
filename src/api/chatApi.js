import { get, post } from './index';

export const getChats = async () => {
  const response = await get('/api/chats'); 
  return response.data;
};

export const getMessages = async (chatId) => {
  const response = await get(`/api/messages/${chatId}`);
  return response.data; 
};

export const createChat = async (name, memberIds) => {
  const response = await post('/api/chats', {
    name: name,
    type: memberIds.length > 1 ? 'group' : 'private',
    memberIds: memberIds,
  });
  return response.data;
};