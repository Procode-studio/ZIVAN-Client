import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getChats, getMessages, markDelivered, markRead } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal.jsx';
import CallInterface from '../components/CallInterface.jsx';
import CallNotification from '../components/CallNotification.jsx';
import ChatHeader from '../components/ChatHeader.jsx';
import MessageList from '../components/MessageList.jsx';
import MinimizedCallView from '../components/MinimizedCallView.jsx';
import { useSimpleCall } from '../hooks/useSimpleCall.js';
import TurnSettingsModal from '../components/TurnSettingsModal.jsx';
import './ChatPage.css';

function ChatPage({ userId }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { socket, joinRoom, sendMessage, startTyping, stopTyping } = useSocket(
    import.meta.env.VITE_API_URL,
    useCallback((message) => {
      if (selectedChat && message.chat_id === selectedChat.id) {
        setMessages((prev) => [...prev, message]);
        if (message.sender_id !== userId) {
          // Fire-and-forget: mark delivered/read for incoming message in open chat
          markDelivered(selectedChat.id).catch(() => {});
          markRead(selectedChat.id).catch(() => {});
        }
      }
    }, [selectedChat, userId]),
    useCallback(({ userId, chatId }) => {
      if (selectedChat?.id === chatId) {
        setTypingUsers(prev => ({ ...prev, [userId]: true }));
      }
    }, [selectedChat]),
    useCallback(({ userId, chatId }) => {
      if (selectedChat?.id === chatId) {
        setTypingUsers(prev => {
          const newTypingUsers = { ...prev };
          delete newTypingUsers[userId];
          return newTypingUsers;
        });
      }
    }, [selectedChat]),
    (users) => setOnlineUsers(new Set(users))
  );

  const otherUser = selectedChat?.members.find(m => m.id !== userId);
  const isOtherUserOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const isOtherUserTyping = otherUser ? typingUsers[otherUser.id] : false;

  // Показывать кнопку настроек только администратору (UI-гейтинг; сервер всё равно защищён)
  const isAdminUI = import.meta.env.VITE_ADMIN_USER_ID
    ? String(userId) === String(import.meta.env.VITE_ADMIN_USER_ID)
    : false;

  const { localStream, remoteStream, call, answer, end, isConnected, toggleMic, toggleCamera, isMicOn, isCameraOn } = useSimpleCall(
    socket,
    otherUser?.id,
    userId,
    () => setReceivingCall(true),
    () => {
      setIsCalling(false);
      setCallAccepted(false);
      setReceivingCall(false);
      setIsCallMinimized(false);
    }
  );

  const [isCalling, setIsCalling] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  useEffect(() => {
    const fetchChats = async () => {
      setLoadingChats(true);
      try {
        const fetched = await getChats();
        setChats(Array.isArray(fetched) ? fetched : []);
      } catch (e) {
        console.warn('[Chats] fetch error', e);
        setChats([]);
      } finally {
        setLoadingChats(false);
      }
    };
    fetchChats();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (isConnected && isCalling) {
      setIsCalling(false);
    }
  }, [isConnected, isCalling]);

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setIsMobileListOpen(false);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const chatMessages = await getMessages(chat.id);
      setMessages(Array.isArray(chatMessages) ? chatMessages : []);
      // Помечаем входящие как доставленные/прочитанные при открытии чата
      markDelivered(chat.id).catch(() => {});
      markRead(chat.id).catch(() => {});
    } catch (e) {
      console.warn('[Messages] fetch error', e);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
    joinRoom(chat.id);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      sendMessage({ chatId: selectedChat.id, content: newMessage });
      setNewMessage('');
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (selectedChat) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      else startTyping(selectedChat.id);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(selectedChat.id);
        typingTimeoutRef.current = null;
      }, 3000);
    }
  };

  const handleCall = () => {
    if (isOtherUserOnline) {
      call();
      setIsCalling(true);
      setCallAccepted(true);
    }
  };

  const handleAnswer = () => {
    setReceivingCall(false);
    setCallAccepted(true);
    answer();
  };

  const handleLeave = () => {
    end();
    socket.emit('endCall', { to: otherUser?.id });
    setIsCalling(false);
    setCallAccepted(false);
    setReceivingCall(false);
    setIsCallMinimized(false);
  };

  return (
    <div className="chat-page">
      {callAccepted && isCallMinimized && (
        <MinimizedCallView
          peerName={otherUser?.username || 'Unknown'}
          onMaximize={() => setIsCallMinimized(false)}
          onLeaveCall={handleLeave}
        />
      )}
      <CallInterface
        callAccepted={callAccepted}
        localStream={localStream}
        remoteStream={remoteStream}
        onLeaveCall={handleLeave}
        peerName={otherUser?.username || 'Unknown'}
        onMinimize={() => setIsCallMinimized(true)}
        isCalling={isCalling}
        isMinimized={isCallMinimized}
        isConnected={isConnected}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
      />

      <header className="chat-header-global">
        <button className="toggle-chat-list" onClick={() => setIsMobileListOpen(v => !v)}>Чаты</button>
        <h1>ZIVAN</h1>
        <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>Выйти</button>
      </header>

      <button className="new-chat-btn" onClick={() => setIsModalOpen(true)}>+ Новый чат</button>
      {isModalOpen && <CreateChatModal onClose={() => setIsModalOpen(false)} onChatCreated={() => getChats().then(res => setChats(Array.isArray(res) ? res : []))} />}

      <div className="chat-container">
        <aside className={`chat-list ${isMobileListOpen ? 'open' : ''}`}>
          {loadingChats ? (
            <p>Загрузка чатов...</p>
          ) : Array.isArray(chats) && chats.length ? (
            chats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
                onClick={() => handleSelectChat(chat)}
              >
                <h3>{chat.name || chat.members.find(m => m.id !== userId)?.username || 'Чат'}</h3>
              </div>
            ))
          ) : (
            <p>Чатов пока нет</p>
          )}
        </aside>
        {isMobileListOpen && <div className="chat-list-overlay" onClick={() => setIsMobileListOpen(false)} />}
        <main className="message-view">
          <ChatHeader
            selectedChat={selectedChat}
            otherUser={otherUser}
            isOtherUserOnline={isOtherUserOnline}
            isOtherUserTyping={isOtherUserTyping}
            onCall={handleCall}
            isCalling={isCalling}
            callAccepted={callAccepted}
            receivingCall={receivingCall}
            onOpenSettings={isAdminUI ? () => setIsSettingsOpen(true) : undefined}
          />
          <MessageList
            selectedChat={selectedChat}
            messages={messages}
            loadingMessages={loadingMessages}
            newMessage={newMessage}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            messagesEndRef={messagesEndRef}
            userId={userId}
          />
        </main>
      </div>

      {isSettingsOpen && (
        <TurnSettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      <CallNotification
        receivingCall={receivingCall}
        callAccepted={callAccepted}
        peerName={otherUser?.username || 'Unknown'}
        onAnswer={handleAnswer}
        onReject={() => setReceivingCall(false)}
      />
    </div>
  );
}

export default ChatPage;
