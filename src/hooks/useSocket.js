import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

// --- ИЗМЕНЕНИЕ: Добавляем 'url' как первый аргумент ---
export const useSocket = (url, onNewMessage) => { 
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !url) return; // <-- Добавляем проверку на url

    // --- ИЗМЕНЕНИЕ: Используем 'url' вместо import.meta.env ---
    socketRef.current = io(url, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket.IO подключен:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO отключен');
    });

    socket.on('newMessage', (message) => {
      if (onNewMessage) {
        onNewMessage(message);
      }
    });
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  // --- ИЗМЕНЕНИЕ: Добавляем 'url' в массив зависимостей ---
  }, [url, onNewMessage]); 

  const joinRoom = useCallback((chatId) => {
    socketRef.current?.emit('joinRoom', chatId);
  }, []);

  const sendMessage = useCallback((messageData) => {
    socketRef.current?.emit('sendMessage', messageData);
  }, []);

  return { joinRoom, sendMessage, socket: socketRef.current };
};