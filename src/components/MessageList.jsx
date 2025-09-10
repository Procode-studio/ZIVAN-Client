import React from 'react';
import './ChatPage.css';

function MessageList({ selectedChat, messages, loadingMessages, newMessage, onSendMessage, onTyping, messagesEndRef }) {
  if (!selectedChat) {
    return <p className="select-chat-prompt">Выберите чат, чтобы начать общение.</p>;
  }

  return (
    <>
      <div className="messages-list">
        {loadingMessages ? (
          <p>Загрузка сообщений...</p>
        ) : (
          messages.map(msg => {
            const isOwnMessage = msg.sender_id === selectedChat.members.find(m => m.id !== msg.sender_id)?.id; // Assuming userId is available in context
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
      <form className="message-form" onSubmit={onSendMessage}>
        <input 
          type="text" 
          placeholder="Введите сообщение..." 
          value={newMessage} 
          onChange={onTyping}
        />
        <button type="submit">Отправить</button>
      </form>
    </>
  );
}

export default MessageList;
