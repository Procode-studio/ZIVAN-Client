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