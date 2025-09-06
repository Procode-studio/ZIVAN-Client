import React, { useState, useEffect, useCallback, useRef } from 'react';
import Peer from 'simple-peer';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal';
import './ChatPage.css';

function ChatPage({ userId }) {
  // Состояния чата
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Состояния звонка
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const { joinRoom, sendMessage, socket } = useSocket(handleNewMessage);

  function handleNewMessage(message) {
    if (selectedChat && message.chat_id === selectedChat.id) {
      setMessages((prev) => [...prev, message]);
    }
  }

  useEffect(() => {
    if (socket) {
      socket.on("hey", (data) => {
        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(data.signal);
      });
    }
  }, [socket]);

  useEffect(() => {
    getChats().then(setChats).catch(() => setError('Не удалось загрузить чаты.')).finally(() => setChatsLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const messagesEndRef = useRef(null);

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
    }
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

  // --- НОВАЯ ЛОГИКА ЗВОНКОВ ---

  const callUser = async (idToCall) => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });
      
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
    } catch (err) {
      console.error("Ошибка доступа к камере или микрофону:", err);
    }
  };

  const answerCall = async () => {
    setCallAccepted(true);
    setReceivingCall(false);
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;

      const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });
      
      peer.on("signal", (data) => {
        socket.emit("acceptCall", { signal: data, to: caller });
      });

      peer.on("stream", (stream) => {
        userVideo.current.srcObject = stream;
      });

      peer.signal(callerSignal);
      connectionRef.current = peer;
    } catch (err) {
      console.error("Ошибка доступа к камере или микрофону:", err);
    }
  };

  const leaveCall = () => {
    setCallAccepted(false);
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
  };

  if (chatsLoading) return <div>Загрузка чатов...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  const otherUserId = selectedChat?.members.find(id => id !== userId);

  return (
    <div>
      <h1>ZIVAN <button onClick={handleLogout}>Выйти</button></h1>
      <button onClick={() => setIsModalOpen(true)}>+ Новый чат</button>
      {isModalOpen && <CreateChatModal onClose={() => setIsModalOpen(false)} onChatCreated={handleChatCreated} />}
      
      <div className="chat-container">
        <div className="chat-list">
          {chats.map(chat => (
            <div key={chat.id} className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`} onClick={() => handleSelectChat(chat)}>
              <h3>{chat.name || `Чат #${chat.id}`}</h3>
            </div>
          ))}
        </div>
        <div className="message-view">
          {selectedChat ? (
            <>
              <div className="chat-header">
                <h2>{selectedChat.name || `Чат #${selectedChat.id}`}</h2>
                {selectedChat.type === 'private' && otherUserId && !callAccepted && (
                  <button onClick={() => callUser(otherUserId)}>Позвонить</button>
                )}
                {callAccepted && <button onClick={leaveCall}>Завершить звонок</button>}
              </div>

              <div className="video-container">
                {stream && <video playsInline muted ref={myVideo} autoPlay style={{ width: "200px" }} />}
                {callAccepted && <video playsInline ref={userVideo} autoPlay style={{ width: "200px" }} />}
              </div>

              <div className="messages-list">
                {messages.map(msg => {
                  const isOwnMessage = msg.sender_id === userId;
                  return (
                    <div key={msg.id} className={`message-row ${isOwnMessage ? 'own' : 'other'}`}>
                      <div className="message"><p>{msg.content}</p><small>{new Date(msg.timestamp).toLocaleTimeString()}</small></div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage}>
                <input type="text" placeholder="Введите сообщение..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <button type="submit">Отправить</button>
              </form>
            </>
          ) : (
            <p>Выберите чат, чтобы начать общение.</p>
          )}
        </div>
      </div>

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