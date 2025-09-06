import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

export const useSocket = (onNewMessage, onUserTyping, onUserStoppedTyping) => {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socketRef.current = io(process.env.REACT_APP_API_URL, {
      auth: {
        token: token,
      },
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

    socket.on('userTyping', (data) => {
      if (onUserTyping) {
        onUserTyping(data);
      }
    });

    socket.on('userStoppedTyping', (data) => {
      if (onUserStoppedTyping) {
        onUserStoppedTyping(data);
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [onNewMessage, onUserTyping, onUserStoppedTyping]);

  const joinRoom = useCallback((chatId) => {
    socketRef.current?.emit('joinRoom', chatId);
  }, []);

  const sendMessage = useCallback((messageData) => {
    socketRef.current?.emit('sendMessage', messageData);
  }, []);

  const startTyping = useCallback((chatId) => {
    socketRef.current?.emit('startTyping', { chatId });
  }, []);

  const stopTyping = useCallback((chatId) => {
    socketRef.current?.emit('stopTyping', { chatId });
  }, []);

  return { joinRoom, sendMessage, startTyping, stopTyping, socket: socketRef.current };
};