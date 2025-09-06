import React, { useState, useEffect, useCallback } from 'react';
import { getChats, getMessages } from '../api/chatApi';
import { useSocket } from '../hooks/useSocket'; // <-- Импортируем наш хук
import './ChatPage.css';

function ChatPage() {
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  const [newMessage, setNewMessage] = useState(''); // <-- Состояние для нового сообщения

  // --- ИНТЕГРАЦИЯ SOCKET.IO ---
  const handleNewMessage = useCallback((message) => {
    // Добавляем новое сообщение в список, только если оно для текущего открытого чата
    if (selectedChat && message.chat_id === selectedChat.id) {
      setMessages((prevMessages) => [...prevMessages, message]);
    }
  }, [selectedChat]);

  const { joinRoom, sendMessage } = useSocket(handleNewMessage);
  // -----------------------------

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

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const chatMessages = await getMessages(chat.id);
      setMessages(chatMessages);
      joinRoom(chat.id); // <-- Присоединяемся к комнате чата через сокет
    } catch (err) {
      setError('Не удалось загрузить сообщения.');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      sendMessage({
        chatId: selectedChat.id,
        content: newMessage,
      });
      setNewMessage(''); // Очищаем поле ввода
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  if (chatsLoading) return <div>Загрузка чатов...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h1>Мессенджер <button onClick={handleLogout}>Выйти</button></h1>
      <div className="chat-container">
        <div className="chat-list">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
              onClick={() => handleSelectChat(chat)}
            >
              <h3>{chat.name || `Чат #${chat.id}`}</h3>
            </div>
          ))}
        </div>
        <div className="message-view">
          {selectedChat ? (
            <>
              <h2>{selectedChat.name || `Чат #${selectedChat.id}`}</h2>
              <div className="messages-list">
                {messagesLoading ? <p>Загрузка...</p> : messages.map(msg => (
                  <div key={msg.id} className="message">
                    <p>{msg.content}</p>
                    <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                  </div>
                ))}
              </div>
              {/* --- РАБОТАЮЩАЯ ФОРМА --- */}
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
            <p>Выберите чат, чтобы начать общение.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatPage;