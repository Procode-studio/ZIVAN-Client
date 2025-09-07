import React, { useState, useEffect, useCallback, useRef } from 'react';
import Peer from 'simple-peer';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal.jsx';
import CallWindow from '../components/CallWindow.jsx';
import './ChatPage.css';

function ChatPage({ userId }) {
  // Состояния чата
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Состояния звонка
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState({ from: null, signal: null });
  const [callAccepted, setCallAccepted] = useState(false);
  const [isCalling, setIsCalling] = useState(false); // <-- НОВОЕ: для отображения "Вызов..."
  
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const messagesEndRef = useRef(null);

  const handleNewMessage = useCallback((message) => {
    if (selectedChat && message.chat_id === selectedChat.id) {
      setMessages((prev) => [...prev, message]);
    }
  }, [selectedChat]);

  const apiUrl = import.meta.env.VITE_API_URL;
  const { joinRoom, sendMessage, socket } = useSocket(apiUrl, handleNewMessage);

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
        connectionRef.current.signal(signal);
      });
      socket.on("callEnded", leaveCall);
    }
    return () => {
      if (socket) {
        socket.off("hey");
        socket.off("callAccepted");
        socket.off("callEnded");
      }
    };
  }, [socket, chats]);

  useEffect(() => { getChats().then(setChats); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    const chatMessages = await getMessages(chat.id);
    setMessages(chatMessages);
    joinRoom(chat.id);
  };

  const startStream = async (cameraOn = false) => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: cameraOn, audio: true });
      setStream(currentStream);
      return currentStream;
    } catch (err) {
      alert("Не удалось получить доступ к микрофону. Проверьте разрешения.");
      return null;
    }
  };

  const callUser = async (idToCall) => {
    const currentStream = await startStream(true); 
    if (!currentStream) return;
    setIsCalling(true);
    
    const peer = new Peer({ initiator: true, trickle: false, stream: currentStream, config: peerConfig });
    connectionRef.current = peer;

    peer.on("signal", (data) => socket.emit("callUser", { userToCall: idToCall, signalData: data, from: userId }));
    peer.on("stream", setPeerStream);
    peer.on("close", leaveCall);
    peer.on("error", leaveCall);
  };

  const answerCall = async () => {
    setReceivingCall(false);
    setCallAccepted(true);
    const currentStream = await startStream(true);
    if (!currentStream) return;

    const peer = new Peer({ initiator: false, trickle: false, stream: currentStream, config: peerConfig });
    connectionRef.current = peer;

    peer.on("signal", (data) => socket.emit("acceptCall", { signal: data, to: callerInfo.from }));
    peer.on("stream", setPeerStream);
    peer.on("close", leaveCall);
    peer.on("error", leaveCall);
    peer.signal(callerInfo.signal);
  };

  const leaveCall = () => {
    if (connectionRef.current) {
      const otherUserId = selectedChat?.members.find(m => m.id !== userId)?.id || callerInfo.from;
      if (otherUserId) socket.emit("endCall", { to: otherUserId });
      connectionRef.current.destroy();
    }
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setPeerStream(null);
    setCallAccepted(false);
    setIsCalling(false);
    setReceivingCall(false);
  };

  const otherUser = selectedChat?.members.find(m => m.id !== userId);

  return (
    <div>
      {callAccepted && (
        <CallWindow stream={stream} myVideoRef={myVideo} userVideoRef={userVideo} onLeaveCall={leaveCall} />
      )}
      <h1>ZIVAN <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>Выйти</button></h1>
      <button onClick={() => setIsModalOpen(true)}>+ Новый чат</button>
      {isModalOpen && <CreateChatModal onClose={() => setIsModalOpen(false)} onChatCreated={() => getChats().then(setChats)} />}
      
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
                {selectedChat.type === 'private' && otherUserId && !isCalling && !callAccepted && !receivingCall && (
                  <button onClick={() => callUser(otherUserId)}>📞 Позвонить</button>
                )}
                {isCalling && <p><i>Вызов...</i></p>}
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
          <h1>Вам звонит {callerInfo.fromName}</h1>
          <button onClick={answerCall}>✅</button>
          <button onClick={() => setReceivingCall(false)}>❌</button>
        </div>
      )}
    </div>
  );
}

export default ChatPage;