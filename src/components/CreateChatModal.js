import React, { useState } from 'react';
import { searchUsers } from '../api/userApi';
import { createChat } from '../api/chatApi';

function CreateChatModal({ onClose, onChatCreated }) {
  const [chatName, setChatName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const users = await searchUsers(searchQuery);
      setSearchResults(users);
    }
  };

  const toggleUserSelection = (user) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0) {
      alert('Выберите хотя бы одного пользователя');
      return;
    }
    const memberIds = selectedUsers.map(u => u.id);
    try {
      const data = await createChat(chatName, memberIds);
      onChatCreated(data.chatId); // Передаем ID нового чата обратно
      onClose(); // Закрываем окно
    } catch (error) {
      alert('Не удалось создать чат');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Создать новый чат</h2>
        <input
          type="text"
          placeholder="Название чата (необязательно)"
          value={chatName}
          onChange={(e) => setChatName(e.target.value)}
        />
        <hr />
        <h4>Добавить участников</h4>
        <div>
          <input
            type="text"
            placeholder="Поиск по имени пользователя"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button onClick={handleSearch}>Найти</button>
        </div>
        <div>
          {searchResults.map(user => (
            <div key={user.id} onClick={() => toggleUserSelection(user)}>
              <input type="checkbox" readOnly checked={selectedUsers.some(u => u.id === user.id)} />
              {user.username}
            </div>
          ))}
        </div>
        <hr />
        <p>Выбрано: {selectedUsers.map(u => u.username).join(', ')}</p>
        <button onClick={handleCreateChat}>Создать чат</button>
        <button onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}

export default CreateChatModal;