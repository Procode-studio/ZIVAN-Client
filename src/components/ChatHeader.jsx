import React from 'react';
import Avatar from './Avatar.jsx';

function ChatHeader({ selectedChat, otherUser, isOtherUserOnline, isOtherUserTyping, onCall, isCalling, callAccepted, receivingCall }) {
  if (!selectedChat) return null;

  return (
    <header className="chat-header">
      <Avatar username={otherUser?.username} size={40} />
      <div className="chat-header-info">
        <h2>{selectedChat.name || otherUser?.username || 'Чат'}</h2>
        <p className="status">{isOtherUserTyping ? 'печатает...' : (isOtherUserOnline ? 'в сети' : 'не в сети')}</p>
      </div>
      <div className="chat-header-actions">
        {selectedChat.type === 'private' && otherUser && !isCalling && !callAccepted && !receivingCall && (
          <button
            onClick={onCall}
            disabled={!isOtherUserOnline}
            className="call-btn"
          >
            📞
          </button>
        )}
      </div>
    </header>
  );
}

export default ChatHeader;
