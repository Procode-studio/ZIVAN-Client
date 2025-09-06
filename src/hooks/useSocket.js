import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

export const useSocket = (onNewMessage) => {
  // useRef используется для хранения экземпляра сокета, чтобы он не пересоздавался при каждом рендере
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Инициализируем соединение, передавая токен для аутентификации
    socketRef.current = io(process.env.REACT_APP_API_URL, {
      auth: {
        token: token,
      },
    });

    const socket = socketRef.current;

    // --- Слушатели событий ---
    socket.on('connect', () => {
      console.log('Socket.IO подключен:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO отключен');
    });

    // Слушаем событие 'newMessage' от сервера
    socket.on('newMessage', (message) => {
      console.log('Получено новое сообщение:', message);
      if (onNewMessage) {
        onNewMessage(message);
      }
    });

    // --- Очистка при размонтировании компонента ---
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [onNewMessage]);

  // --- Функции для отправки событий на сервер ---
  const joinRoom = useCallback((chatId) => {
    socketRef.current?.emit('joinRoom', chatId);
  }, []);

  const sendMessage = useCallback((messageData) => {
    socketRef.current?.emit('sendMessage', messageData);
  }, []);

  return { joinRoom, sendMessage };
};