import React, { useState, useEffect, useCallback, useRef } from 'react';
import Peer from 'simple-peer';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal';
import './ChatPage.css';

function ChatPage({ userId }) {
  // --- Состояния для чата ---
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- Состояния для звонков ---
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  // --- Обработчики событий сокета ---
  const handleNewMessage = useCallback((message) => {
    if (selectedChat && message.chat_id === selectedChat.id) {
      setMessages((prevMessages) => [...prevMessages, message]);
    }
  }, [selectedChat]);

  const handleUserTyping = useCallback(({ userId, chatId }) => {
    if (selectedChat?.id === chatId) {
      setTypingUsers(prev => [...new Set([...prev, userId])]);
    }
  }, [selectedChat]);

  const handleUserStoppedTyping = useCallback(({ userId, chatId }) => {
    if (selectedChat?.id === chatId) {
      setTypingUsers(prev => prev.filter(id => id !== userId));
    }
  }, [selectedChat]);

  const { joinRoom, sendMessage, startTyping, stopTyping, socket } = useSocket(
    handleNewMessage,
    handleUserTyping,
    handleUserStoppedTyping
  );

  // --- Эффекты ---
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setStream(stream);
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
    });

    if (socket) {
      socket.on("hey", (data) => {
        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(data.signal);
      });
    }
  }, [socket]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const userChats = await getChats();
        setChats(userChats);
      } catch (err) {
        setError('Не удалось загрузить чаты.');
        if (err.response?.status === 401) handleLogout();
      } finally {
        setChatsLoading(false);
      }
    };
    fetchChats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Функции чата ---
  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const chatMessages = await getMessages(chat.id);
      setMessages(chatMessages);
      joinRoom(chat.id);
    } catch (err) {
      setError('Не удалось загрузить сообщения.');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      sendMessage({ chatId: selectedChat.id, content: newMessage });
      setNewMessage('');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        stopTyping(selectedChat.id);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    else startTyping(selectedChat.id);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(selectedChat.id);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleChatCreated = async () => {
    setChatsLoading(true);
    const userChats = await getChats();
    setChats(userChats);
    setChatsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // --- Функции звонка ---
  const callUser = (idToCall) => {
    const peer = new Peer({ initiator: true, trickle: false, stream: stream });
    peer.on("signal", (data) => {
      socket.emit("callUser", { userToCall: idToCall, signalData: data, from: userId });
    });
    peer.on("stream", (stream) => {
      if (userVideo.current) userVideo.current.srcObject = stream;
    });
    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });
    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({ initiator: false, trickle: false, stream: stream });
    peer.on("signal", (data) => {
      socket.emit("acceptCall", { signal: data, to: caller });
    });
    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream;
    });
    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) connectionRef.current.destroy();
    // Можно добавить перезагрузку страницы или сброс состояний
  };

  if (chatsLoading) return <div>Загрузка чатов...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h1>ZIVAN <button onClick={handleLogout}>Выйти</button></h1>
      <button onClick={() => setIsModalOpen(true)}>+ Новый чат</button>
      {isModalOpen && <CreateChatModal onClose={() => setIsModalOpen(false)} onChatCreated={handleChatCreated} />}
      
      {/* --- Видео-элементы --- */}
      <div className="video-container">
        <div className="video">
          {stream && <video playsInline muted ref={myVideo} autoPlay style={{ width: "200px" }} />}
        </div>
        <div className="video">
          {callAccepted && !callEnded && <video playsInline ref={userVideo} autoPlay style={{ width: "200px" }} />}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-list">
          {chats.map(chat => (
            <div key={chat.id} className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`} onClick={() => handleSelectChat(chat)}>
              <h3>{chat.name || `Чат #${chat.id}`}</h3>
              {/* Здесь можно будет добавить кнопку звонка */}
            </div>
          ))}
        </div>
        <div className="message-view">
          {selectedChat ? (
            <>
              <h2>{selectedChat.name || `Чат #${selectedChat.id}`}</h2>
              <div className="messages-list">
                {messagesLoading ? <p>Загрузка...</p> : messages.map(msg => {
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
              <div className="typing-indicator">
                {typingUsers.length > 0 && <p><i>{`User(s) ${typingUsers.join(', ')} is typing...`}</i></p>}
              </div>
              <form onSubmit={handleSendMessage}>
                <input type="text" placeholder="Введите сообщение..." value={newMessage} onChange={handleTyping} />
                <button type="submit">Отправить</button>
              </form>
            </>
          ) : (
            <p>Выберите чат, чтобы начать общение.</p>
          )}
        </div>
      </div>

      {/* --- Уведомление о входящем звонке --- */}
      {receivingCall && !callAccepted && (
        <div className="caller-notification">
          <h1>Вам звонит пользователь {caller}</h1>
          <button onClick={answerCall}>Ответить</button>
        </div>
      )}
    </div>
  );
}

export default ChatPage;