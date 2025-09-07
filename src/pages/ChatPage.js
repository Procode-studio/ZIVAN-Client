import React, { useState, useEffect, useCallback, useRef } from 'react';
import Peer from 'simple-peer';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket';
import CreateChatModal from '../components/CreateChatModal';
import CallWindow from '../components/CallWindow';
import './ChatPage.css';

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
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState({ from: null, signal: null });
  const [callAccepted, setCallAccepted] = useState(false);
  
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const messagesEndRef = useRef(null);

  const handleNewMessage = useCallback((message) => {
    if (selectedChat && message.chat_id === selectedChat.id) {
      setMessages((prev) => [...prev, message]);
    }
  }, [selectedChat]);

  const { joinRoom, sendMessage, socket } = useSocket(handleNewMessage);

  useEffect(() => {
    if (socket) {
      socket.on("hey", (data) => {
        setReceivingCall(true);
        setCallerInfo({ from: data.from, signal: data.signal });
      });
      socket.on("callAccepted", (signal) => {
        setCallAccepted(true);
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      });
    }
    return () => {
      if (socket) {
        socket.off("hey");
        socket.off("callAccepted");
      }
    };
  }, [socket]);

  useEffect(() => { getChats().then(setChats); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    const chatMessages = await getMessages(chat.id);
    setMessages(chatMessages);
    joinRoom(chat.id);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      sendMessage({ chatId: selectedChat.id, content: newMessage });
      setNewMessage('');
    }
  };

  const startStream = async () => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      return currentStream;
    } catch (err) {
      console.error("Ошибка доступа к камере:", err);
      return null;
    }
  };

  const callUser = async (idToCall) => {
    const currentStream = await startStream();
    if (!currentStream) return;

    const peer = new Peer({ 
      initiator: true, 
      trickle: false, 
      stream: currentStream,
      config: peerConfig 
    });
    connectionRef.current = peer;

    peer.on("signal", (data) => {
      socket.emit("callUser", { userToCall: idToCall, signalData: data, from: userId });
    });
    peer.on("stream", (stream) => {
      if (userVideo.current) userVideo.current.srcObject = stream;
    });
  };

  const answerCall = async () => {
    setCallAccepted(true);
    setReceivingCall(false);

    const currentStream = await startStream();
    if (!currentStream) return;

    const peer = new Peer({ 
      initiator: false, 
      trickle: false, 
      stream: currentStream,
      config: peerConfig
    });
    connectionRef.current = peer;

    peer.on("signal", (data) => {
      socket.emit("acceptCall", { signal: data, to: callerInfo.from });
    });
    peer.on("stream", (stream) => {
      if (userVideo.current) userVideo.current.srcObject = stream;
    });

    peer.signal(callerInfo.signal);
  };

  const leaveCall = () => {
    setCallAccepted(false);
    setReceivingCall(false);
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
  };

  const otherUserId = selectedChat?.members.find(id => id !== userId);

  return (
    <div>
      {callAccepted && (
        <CallWindow
          stream={stream}
          myVideoRef={myVideo}
          userVideoRef={userVideo}
          onLeaveCall={leaveCall}
        />
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
                {selectedChat.type === 'private' && otherUserId && !callAccepted && !receivingCall && (
                  <button onClick={() => callUser(otherUserId)}>📞 Позвонить</button>
                )}
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
          <h1>Вам звонит пользователь {callerInfo.from}</h1>
          <button onClick={answerCall}>Ответить</button>
        </div>
      )}
    </div>
  );
}

export default ChatPage;