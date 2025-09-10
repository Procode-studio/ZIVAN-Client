import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal.jsx';
import CallUI from '../components/CallUI.jsx';
import MinimizedCallView from '../components/MinimizedCallView.jsx';
import Avatar from '../components/Avatar.jsx';
import useCallHandler from '../hooks/useCallHandler'; // New hook
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
  
  const [iceConfig, setIceConfig] = useState({ iceServers: [] });
  useEffect(() => {
    const loadIce = async () => {
      try {
        const base = import.meta.env.VITE_API_URL;
        if (!base) return; // fallback: leave empty config
        const res = await fetch(`${base}/api/config/ice`);
        if (res.ok) {
          const cfg = await res.json();
          setIceConfig(cfg);
        }
      } catch (e) {
        console.error('Failed to load ICE config', e);
      }
    };
    loadIce();
  }, []);

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
    }, [selectedChat])
  );

  const {
    stream,
    peerStream,
    receivingCall,
    callerInfo,
    callAccepted,
    isCalling,
    isCallMinimized,
    leaveCall,
    callUser,
    answerCall,
    setReceivingCall,
    setIsCallMinimized,
	isMicOn,
    isCameraOn,
    peerCameraOn,
    toggleMic,
    toggleCamera
  } = useCallHandler(socket, selectedChat, userId, chats, iceConfig);

  useEffect(() => {
    if (socket) {
      socket.on('updateOnlineUsers', (users) => setOnlineUsers(new Set(users)));
    }
    return () => {
      if (socket) socket.off('updateOnlineUsers');
    };
  }, [socket]);

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

  const otherUser = selectedChat?.members.find(m => m.id !== userId);
  const isOtherUserOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const isOtherUserTyping = otherUser ? typingUsers[otherUser.id] : false;

  return (
    <div className="chat-page">
      {callAccepted && (
        <CallUI 
          stream={stream} 
          peerStream={peerStream} 
          onLeaveCall={leaveCall} 
          peerName={otherUser?.username || callerInfo.fromName}
          onMinimize={() => setIsCallMinimized(true)}
          isCalling={isCalling}
          isMinimized={isCallMinimized}
		  isMicOn={isMicOn}
		  isCameraOn={isCameraOn}
		  peerCameraOn={peerCameraOn}
		  toggleMic={toggleMic}
		  toggleCamera={toggleCamera}
        />
      )}
      
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
          {callAccepted && isCallMinimized && (
            <MinimizedCallView 
              peerName={otherUser?.username || callerInfo.fromName} 
              onMaximize={() => setIsCallMinimized(false)} 
              onLeaveCall={leaveCall} 
            />
          )}
          {selectedChat ? (
            <>
              <header className="chat-header">
                <Avatar username={otherUser?.username} size={40} />
                <div className="chat-header-info">
                  <h2>{selectedChat.name || otherUser?.username || 'Чат'}</h2>
                  <p className="status">{isOtherUserTyping ? 'печатает...' : (isOtherUserOnline ? 'в сети' : 'не в сети')}</p>
                </div>
                <div className="chat-header-actions">
                  {selectedChat.type === 'private' && otherUser && !isCalling && !callAccepted && !receivingCall && (
                    <button
                      onClick={() => callUser(otherUser.id)}
                      disabled={!isOtherUserOnline || !(iceConfig?.iceServers?.length)}
                      className="call-btn"
                      title={!(iceConfig?.iceServers?.length) ? 'Загрузка конфигурации звонка...' : ''}
                    >
                      📞
                    </button>
                  )}
                  {isCalling && <p className="calling-status"><i>Вызов...</i></p>}
                </div>
              </header>
              <div className="messages-list">
                {loadingMessages ? (
                  <p>Загрузка сообщений...</p>
                ) : (
                  messages.map(msg => {
                    const isOwnMessage = msg.sender_id === userId;
                    return (
                      <div key={msg.id} className={`message-row ${isOwnMessage ? 'own' : 'other'}`}>
                        <div className="message">
                          <p>{msg.content}</p>
                          <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form className="message-form" onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  placeholder="Введите сообщение..." 
                  value={newMessage} 
                  onChange={handleTyping}
                />
                <button type="submit">Отправить</button>
              </form>
            </>
          ) : (
            <p className="select-chat-prompt">Выберите чат, чтобы начать общение.</p>
          )}
        </main>
      </div>

      {receivingCall && !callAccepted && (
        <div className="caller-notification">
          <h1>Вам звонит {callerInfo.fromName}</h1>
          <div>
            <button className="control-btn" onClick={answerCall}>✅</button>
            <button className="control-btn hang-up" onClick={() => setReceivingCall(false)}>❌</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPage;
