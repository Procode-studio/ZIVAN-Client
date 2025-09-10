import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

export const useSocket = (url, onNewMessage, onUserTyping, onUserStoppedTyping, onPresenceUpdate) => {
  const socketRef = useRef(null);

  // Keep latest callbacks in refs so we don't recreate the socket on every render
  const onNewMessageRef = useRef(onNewMessage);
  const onUserTypingRef = useRef(onUserTyping);
  const onUserStoppedTypingRef = useRef(onUserStoppedTyping);
  const onPresenceUpdateRef = useRef(onPresenceUpdate);

  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { onUserTypingRef.current = onUserTyping; }, [onUserTyping]);
  useEffect(() => { onUserStoppedTypingRef.current = onUserStoppedTyping; }, [onUserStoppedTyping]);
  useEffect(() => { onPresenceUpdateRef.current = onPresenceUpdate; }, [onPresenceUpdate]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !url) return;

    // Some hosting providers/proxies (like Render free tier) may drop WebSocket upgrades intermittently.
    // Force long-polling in production as a stability fallback.
    const isProd = /https?:\/\/zivan\.onrender\.com/i.test(url);
    const connectionOptions = {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      transports: isProd ? ['polling'] : ['websocket', 'polling'],
      upgrade: isProd ? false : true,
    };

    const socket = io(url, connectionOptions);
    socketRef.current = socket;

    socket.on('connect', () => console.log('Socket.IO подключен:', socket.id));
    socket.on('disconnect', (reason) => console.log('Socket.IO отключен', reason));
    socket.on('connect_error', (err) => console.log('Socket.IO connect_error:', err.message));
    socket.on('reconnect_attempt', (n) => console.log('Socket.IO reconnect_attempt:', n));
    socket.on('reconnect', (n) => console.log('Socket.IO reconnect:', n));

    // Stable handlers that call the latest refs
    socket.on('newMessage', (data) => onNewMessageRef.current && onNewMessageRef.current(data));
    socket.on('userTyping', (data) => onUserTypingRef.current && onUserTypingRef.current(data));
    socket.on('userStoppedTyping', (data) => onUserStoppedTypingRef.current && onUserStoppedTypingRef.current(data));
    socket.on('updateOnlineUsers', (users) => onPresenceUpdateRef.current && onPresenceUpdateRef.current(users));

    return () => {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
    };
  }, [url]);

  const joinRoom = useCallback((chatId) => socketRef.current?.emit('joinRoom', chatId), []);
  const sendMessage = useCallback((data) => socketRef.current?.emit('sendMessage', data), []);
  const startTyping = useCallback((chatId) => socketRef.current?.emit('startTyping', { chatId }), []);
  const stopTyping = useCallback((chatId) => socketRef.current?.emit('stopTyping', { chatId }), []);

  return { joinRoom, sendMessage, startTyping, stopTyping, socket: socketRef.current };
};