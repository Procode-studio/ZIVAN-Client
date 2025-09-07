import React, { useState, useEffect, useCallback, useRef } from 'react';
import Peer from 'simple-peer';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal.jsx';
import CallUI from '../components/CallUI.jsx';
import './ChatPage.css';
import MinimizedCallView from '../components/MinimizedCallView.jsx'; // <-- ИМПОРТ
import Avatar from '../components/Avatar.jsx';

// Конфигурация STUN/TURN серверов для обхода сетевых ограничений
const peerConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun.openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

function ChatPage({ userId }) {
  // Состояния для чатов и сообщений
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Состояния для звонков
  const [stream, setStream] = useState(null);
  const [peerStream, setPeerStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState({ from: null, signal: null, fromName: '' });
  const [callAccepted, setCallAccepted] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // Refs для DOM-элементов и соединений
  const connectionRef = useRef();
  const messagesEndRef = useRef(null);

  // Обработчик новых сообщений из сокета
  const handleNewMessage = useCallback((message) => {
    // Добавляем сообщение в список, только если открыт соответствующий чат
    if (selectedChat && message.chat_id === selectedChat.id) {
      setMessages((prevMessages) => [...prevMessages, message]);
    }
  }, [selectedChat]);

  const { joinRoom, sendMessage, socket } = useSocket(import.meta.env.VITE_API_URL, handleNewMessage);

  // Эффект для установки слушателей событий сокета
  useEffect(() => {
    if (socket) {
      socket.on("hey", (data) => {
        const chatWithCaller = chats.find(chat => chat.members.some(m => m.id === data.from));
        const callerName = chatWithCaller?.members.find(m => m.id === data.from)?.username || 'Unknown Caller';
        setCallerInfo({ from: data.from, signal: data.signal, fromName: callerName });
        setReceivingCall(true);
      });
      socket.on("callAccepted", (signal) => {
        setIsCalling(false);
        setCallAccepted(true);
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      });
      socket.on("callEnded", leaveCall);
	  socket.on('updateOnlineUsers', (users) => setOnlineUsers(new Set(users)));
    }
    return () => {
      if (socket) {
        socket.off("hey");
        socket.off("callAccepted");
        socket.off("callEnded");
      }
    };
  }, [socket, chats]); // Добавляем chats в зависимости, чтобы callerName был актуальным

  // Эффекты для загрузки чатов и авто-прокрутки
  useEffect(() => { getChats().then(setChats); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Обработчик выбора чата
  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setMessages([]);
    const chatMessages = await getMessages(chat.id);
    setMessages(chatMessages);
    joinRoom(chat.id);
  };

  // Обработчик отправки сообщения
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      sendMessage({ chatId: selectedChat.id, content: newMessage });
      setNewMessage('');
    }
  };

  // Функция для получения доступа к камере/микрофону
  const startStream = async (cameraOn = false) => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: cameraOn, audio: true });
      setStream(currentStream);
      return currentStream;
    } catch (err) {
      alert("Не удалось получить доступ к микрофону или камере. Проверьте разрешения в браузере и убедитесь, что устройства не используются другим приложением.");
      return null;
    }
  };

  const callUser = async (idToCall) => {
    const currentStream = await startStream(false);
    if (!currentStream) return;
    setIsCalling(true);
    
    const peer = new Peer({ initiator: true, trickle: false, stream: currentStream, config: peerConfig });
    connectionRef.current = peer;

    peer.on("signal", (data) => socket.emit("callUser", { userToCall: idToCall, signalData: data, from: userId }));
    peer.on("stream", (stream) => setPeerStream(stream));
    peer.on("close", leaveCall);
    peer.on("error", leaveCall);
  };

  const answerCall = async () => {
    setReceivingCall(false);
    const currentStream = await startStream(false);
    if (!currentStream) return;
    setCallAccepted(true);

    const peer = new Peer({ initiator: false, trickle: false, stream: currentStream, config: peerConfig });
    connectionRef.current = peer;

    peer.on("signal", (data) => socket.emit("acceptCall", { signal: data, to: callerInfo.from }));
    peer.on("stream", (stream) => setPeerStream(stream));
    peer.on("close", leaveCall);
    peer.on("error", leaveCall);
    peer.signal(callerInfo.signal);
  };

  const leaveCall = useCallback(() => {
    if (connectionRef.current) {
      const otherUserInCall = selectedChat?.members.find(m => m.id !== userId) || { id: callerInfo.from };
      if (otherUserInCall.id) socket.emit("endCall", { to: otherUserInCall.id });
      connectionRef.current.destroy();
    }
    if (stream) stream.getTracks().forEach(track => track.stop());
    
    setStream(null);
    setPeerStream(null);
    setCallAccepted(false);
    setIsCalling(false);
    setReceivingCall(false);
    setIsCallMinimized(false);
    setCallerInfo({ from: null, signal: null, fromName: '' });
    connectionRef.current = null;
  }, [socket, stream, selectedChat, userId, callerInfo.from]);

  const otherUser = selectedChat?.members.find(m => m.id !== userId);
  const isOtherUserOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

  return (
    <div>
      {/* Окно звонка на весь экран (показывается, когда звонок принят и не свернут) */}
      {callAccepted && !isCallMinimized && (
        <CallUI 
          stream={stream} 
          peerStream={peerStream} 
          onLeaveCall={leaveCall} 
          peerName={otherUser?.username || callerInfo.fromName}
          onMinimize={() => setIsCallMinimized(true)}
        />
      )}
      
      {/* Главный заголовок приложения */}
      <h1>ZIVAN <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>Выйти</button></h1>
      
      {/* Кнопка создания нового чата */}
      <button onClick={() => setIsModalOpen(true)}>+ Новый чат</button>
      
      {/* Модальное окно для создания чата */}
      {isModalOpen && <CreateChatModal onClose={() => setIsModalOpen(false)} onChatCreated={() => getChats().then(setChats)} />}
      
      {/* Основной контейнер чата */}
      <div className="chat-container">
        
        {/* Левая колонка: список чатов */}
        <div className="chat-list">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`} 
              onClick={() => handleSelectChat(chat)}
            >
              <h3>{chat.name || chat.members.find(m => m.id !== userId)?.username || 'Чат'}</h3>
            </div>
          ))}
        </div>
        
        {/* Правая колонка: просмотр сообщений */}
        <div className="message-view">
          
          {/* Свернутая панель звонка (показывается, когда звонок принят и свернут) */}
          {callAccepted && isCallMinimized && (
            <MinimizedCallView 
              peerName={otherUser?.username || callerInfo.fromName} 
              onMaximize={() => setIsCallMinimized(false)} 
              onLeaveCall={leaveCall} 
            />
          )}

          {selectedChat ? (
            <>
              {/* Заголовок выбранного чата */}
              <div className="chat-header">
                <Avatar username={otherUser?.username} size={40} />
                <div className="chat-header-info">
                  <h2>{selectedChat.name || otherUser?.username || 'Чат'}</h2>
                  <p className="status">{isOtherUserOnline ? 'в сети' : 'не в сети'}</p>
                </div>
                <div className="chat-header-actions">
                  {selectedChat.type === 'private' && otherUser && !isCalling && !callAccepted && !receivingCall && (
                    <button onClick={() => callUser(otherUser.id)} disabled={!isOtherUserOnline} className="call-btn">📞</button>
                  )}
                  {isCalling && <p><i>Вызов...</i></p>}
                </div>
              </div>
              
              {/* Список сообщений */}
              <div className="messages-list">
                {messages.map(msg => {
                  const isOwnMessage = msg.sender_id === userId;
                  return (
                    <div key={msg.id} className={`message-row ${isOwnMessage ? 'own' : 'other'}`}>
                      <div className="message">
                        <p>{msg.content}</p>
                        <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Форма отправки сообщения */}
              <form onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  placeholder="Введите сообщение..." 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                />
                <button type="submit">Отправить</button>
              </form>
            </>
          ) : (
            <p className="select-chat-prompt">Выберите чат, чтобы начать общение.</p>
          )}
        </div>
      </div>

      {/* Уведомление о входящем звонке */}
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