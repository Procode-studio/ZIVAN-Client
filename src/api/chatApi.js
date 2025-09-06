import apiClient from './index';

// Функция для получения списка чатов пользователя
export const getChats = async () => {
  const response = await apiClient.get('/api/chats');
  return response.data; // Возвращаем массив чатов
};

// Функция для получения истории сообщений для конкретного чата
export const getMessages = async (chatId) => {
  const response = await apiClient.get(`/api/messages/${chatId}`);
  return response.data; // Возвращаем массив сообщений
};

export const createChat = async (name, memberIds) => {
  const response = await apiClient.post('/api/chats', {
    name: name,
    type: memberIds.length > 1 ? 'group' : 'private', // Автоматически определяем тип
    memberIds: memberIds,
  });
  return response.data;
};