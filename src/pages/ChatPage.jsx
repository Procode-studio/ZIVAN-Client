import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal.jsx';
import CallInterface from '../components/CallInterface.jsx';
import CallNotification from '../components/CallNotification.jsx';
import ChatHeader from '../components/ChatHeader.jsx';
import MessageList from '../components/MessageList.jsx';
import Avatar from '../components/Avatar.jsx';
import { useSimpleCall } from '../hooks/useSimpleCall.js';
import './ChatPage.css';

function ChatPage({ userId }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { socket, joinRoom, sendMessage, startTyping, stopTyping } = useSocket(
    import.meta.env.VITE_API_URL,
    useCallback((message) => {
      if (selectedChat && message.chat_id === selectedChat.id) {
        setMessages((prev) => [...prev, message]);
      }
    }, [selectedChat]),
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

  const { localStream, remoteStream, call, isConnected } = useSimpleCall(socket, otherUser?.id, () => setReceivingCall(true));

  const [isCalling, setIsCalling] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  useEffect(() => {
    const fetchChats = async () => {
      setLoadingChats(true);
      const fetchedChats = await getChats();
      setChats(fetchedChats);
      setLoadingChats(false);
    };
    fetchChats();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    setMessages([]);
    const chatMessages = await getMessages(chat.id);
    setMessages(chatMessages);
    setLoadingMessages(false);
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
  };

  const handleLeave = () => {
    socket.emit('endCall', { to: otherUser?.id });
    setIsCalling(false);
    setCallAccepted(false);
    setReceivingCall(false);
  };

  return (
    <div className="chat-page">
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
        isCallMinimized={isCallMinimized}
        setIsCallMinimized={setIsCallMinimized}
      />

      <header className="chat-header-global">
        <h1>ZIVAN</h1>
        <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>Выйти</button>
      </header>

      <button className="new-chat-btn" onClick={() => setIsModalOpen(true)}>+ Новый чат</button>
      {isModalOpen && <CreateChatModal onClose={() => setIsModalOpen(false)} onChatCreated={() => getChats().then(setChats)} />}

      <div className="chat-container">
        <aside className="chat-list">
          {loadingChats ? (
            <p>Загрузка чатов...</p>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
                onClick={() => handleSelectChat(chat)}
              >
                <h3>{chat.name || chat.members.find(m => m.id !== userId)?.username || 'Чат'}</h3>
              </div>
            ))
          )}
        </aside>
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
