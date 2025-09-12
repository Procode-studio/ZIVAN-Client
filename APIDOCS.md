# ZIVAN — Документация для клиента

Этот документ описывает, как работает веб‑клиент ZIVAN: авторизация, чаты, сообщения, статусы, присутствие, печать, звонки (WebRTC) и взаимодействие с публичным клиентским API. Здесь нет внутренних деталей сервера и секретов — только то, что нужно для разработки и интеграции клиентского UI.

## 1. Общее устройство
- Клиент — это SPA на React + Vite.
- Аутентификация — по JWT, передаётся в каждом запросе в заголовке `Authorization: Bearer <JWT>`.
- Реалтайм — через Socket.IO: новые сообщения, индикатор печати, онлайн‑статус, сигнальные события для звонков.
- Звонки — WebRTC: клиент получает ICE‑настройки (STUN/TURN) по защищённому эндпоинту и обменивается SDP/ICE через Socket.IO.

## 2. Авторизация
1) Регистрация (опционально):
```
POST /api/auth/register
{ "login": "user1", "password": "secret", "displayName": "Иван" }
```
Ответ содержит созданного пользователя.

2) Вход:
```
POST /api/auth/login
{ "login": "user1", "password": "secret" }
```
Ответ:
```
{ "token": "<JWT>" }
```
Сохраните `token` (например, `localStorage`) и добавляйте в каждый запрос:
```
Authorization: Bearer <JWT>
```

## 3. Чаты
- Получить список чатов:
```
GET /api/chats
Headers: Authorization: Bearer <JWT>
```
Пример ответа:
```json
[
  {
    "id": 10,
    "type": "private",
    "name": null,
    "members": [
      { "id": 1, "username": "Иван", "login": "ivan" },
      { "id": 2, "username": "Ольга", "login": "olga" }
    ]
  }
]
```
- Создать чат:
```json
POST /api/chats
{ "name": "Новый чат", "type": "private", "memberIds": [2] }
```
Ответ: `{ "message": "Chat created successfully", "chatId": 11 }`

## 4. Сообщения
- Получить сообщения чата:
```
GET /api/messages/:chatId
```
Ответ (пример):
```json
[
  { "id": 1, "chat_id": 10, "sender_id": 1, "content": "Привет", "type": "text", "status": "sent", "timestamp": "2025-09-12T10:00:00Z" }
]
```
- Отметить входящие как доставленные:
```
POST /api/messages/:chatId/delivered
```
- Отметить входящие как прочитанные:
```
POST /api/messages/:chatId/read
```

В текущей упрощённой модели статус хранится «на чат», не по каждому получателю. Для большинства простых UI этого достаточно.

## 5. Реалтайм через Socket.IO
Подключение:
```js
import io from 'socket.io-client';
const socket = io(BASE, {
  auth: { token: '<JWT>' },
  transports: ['websocket', 'polling']
});
```
- Вступить в комнату чата:
```js
socket.emit('joinRoom', chatId);
```
- Отправить сообщение:
```js
socket.emit('sendMessage', { chatId, content: 'Привет!', type: 'text' });
```
- Печать:
```js
socket.emit('startTyping', { chatId });
socket.emit('stopTyping', { chatId });
```
- События клиента:
```js
socket.on('newMessage', (msg) => { /* добавить в список */ });
socket.on('userTyping', ({ userId, chatId }) => { /* показать печать */ });
socket.on('userStoppedTyping', ({ userId, chatId }) => { /* скрыть печать */ });
socket.on('updateOnlineUsers', (ids) => { /* обновить индикаторы онлайн */ });
```

## 6. Индикаторы: онлайн и печать
- Онлайн: сервер периодически уведомляет `updateOnlineUsers` — это список ID онлайн‑пользователей. Сопоставьте с участниками чата и отрисуйте зелёную точку/статус.
- Печать: при вводе отправляйте `startTyping`, при паузе — `stopTyping`. Клиент по событию показывает «Печатает…» у собеседника.

## 7. Голос/Видео звонки (WebRTC)
1) Получение ICE‑конфигурации (STUN/TURN):
```
GET /api/config/ice
Headers: Authorization: Bearer <JWT>
```
Ответ (пример):
```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "turn:host:3478", "username": "...", "credential": "..." }
  ]
}
```
Учётки TURN краткоживущие и выдаются динамически. Хранить секреты в клиенте не нужно.

2) Базовый поток звонка (сигналинг через Socket.IO):
- Звонящий:
  - создаёт `RTCPeerConnection` с `iceServers`;
  - добавляет свои трэки (микрофон/камера);
  - делает offer и отправляет его через `socket.emit('callUser', { userToCall, signalData: offer, from: selfId })`;
- Принимающий:
  - получает `socket.on('hey', ({ signal, from }))`;
  - создаёт `RTCPeerConnection`, добавляет свои трэки;
  - `setRemoteDescription(offer)`, делает answer и отправляет `socket.emit('acceptCall', { signal: answer, to: from })`;
- ICE‑кандидаты:
  - обе стороны шлют `socket.emit('iceCandidate', { to, candidate })`;
  - принимающая сторона добавляет `peer.addIceCandidate(candidate)`.

Пример упрощённого кода см. в `zivan-client/src/hooks/useSimpleCall.js`.

## 8. Рекомендации по производительности и лимитам
- Кэшируйте ICE в памяти клиента хотя бы на 30–60 секунд; не запрашивайте каждую секунду.
- Используйте сокет‑события для инкрементальных обновлений, а REST — для первичной загрузки.
- При ретраях используйте экспоненциальную задержку и ограничение количества попыток.

## 9. Безопасность
- Только `Authorization: Bearer <JWT>` — cookies не используются.
- Не храните секреты в клиенте.
- Все проверки прав происходят на сервере, клиент лишь отображает доступные действия.

## 10. Мини‑пример включения клиента
```js
// Авторизация
const token = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'user1', password: 'secret' })
}).then(r => r.json()).then(x => x.token);

// Чаты
const chats = await fetch(`${BASE}/api/chats`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// Socket.IO
const socket = io(BASE, { auth: { token } });
socket.emit('joinRoom', chats[0].id);
socket.on('newMessage', console.log);

// Звонки: ICE
const iceCfg = await fetch(`${BASE}/api/config/ice`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());
```

Этого достаточно, чтобы написать свой кастомный клиент для ZIVAN и корректно взаимодействовать с публичным клиентским API.
