import React, { useState, useEffect } from 'react';
import { getChats } from '../api/chatApi'; // Импортируем нашу новую функцию

function ChatPage() {
  const [chats, setChats] = useState([]); // Состояние для хранения списка чатов
  const [loading, setLoading] = useState(true); // Состояние для отслеживания загрузки
  const [error, setError] = useState(''); // Состояние для ошибок

  // useEffect будет выполняться один раз при загрузке компонента
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const userChats = await getChats();
        setChats(userChats); // Сохраняем чаты в состояние
      } catch (err) {
        setError('Не удалось загрузить чаты.');
        // Если токен невалидный, бэкенд вернет 401 ошибку
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      } finally {
        setLoading(false); // Загрузка завершена
      }
    };

    fetchChats();
  }, []); // Пустой массив зависимостей означает "выполнить только один раз"

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // --- Рендеринг компонента ---
  if (loading) {
    return <div>Загрузка чатов...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  return (
    <div>
      <h1>Ваши чаты</h1>
      <button onClick={handleLogout}>Выйти</button>
      
      <div className="chat-list">
        {chats.length > 0 ? (
          chats.map(chat => (
            <div key={chat.id} className="chat-item">
              {/* В будущем по клику на этот div мы будем открывать чат */}
              <h3>{chat.name || `Чат #${chat.id}`}</h3>
            </div>
          ))
        ) : (
          <p>У вас пока нет чатов.</p>
        )}
      </div>
    </div>
  );
}

export default ChatPage;