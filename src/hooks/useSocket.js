import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

export const useSocket = (url, onNewMessage, onUserTyping, onUserStoppedTyping) => {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !url) return;

    socketRef.current = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    const socket = socketRef.current;

    socket.on('connect', () => console.log('Socket.IO подключен:', socket.id));
    socket.on('disconnect', () => console.log('Socket.IO отключен'));
    if (onNewMessage) socket.on('newMessage', onNewMessage);
    if (onUserTyping) socket.on('userTyping', onUserTyping);
    if (onUserStoppedTyping) socket.on('userStoppedTyping', onUserStoppedTyping);

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [url, onNewMessage, onUserTyping, onUserStoppedTyping]);

  const joinRoom = useCallback((chatId) => socketRef.current?.emit('joinRoom', chatId), []);
  const sendMessage = useCallback((data) => socketRef.current?.emit('sendMessage', data), []);
  const startTyping = useCallback((chatId) => socketRef.current?.emit('startTyping', { chatId }), []);
  const stopTyping = useCallback((chatId) => socketRef.current?.emit('stopTyping', { chatId }), []);

  return { joinRoom, sendMessage, startTyping, stopTyping, socket: socketRef.current };
};