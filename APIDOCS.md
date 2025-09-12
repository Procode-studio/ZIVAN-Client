# ZIVAN Customization Guide

This guide explains how to customize the ZIVAN web client UI safely, without exposing any sensitive data. It does not cover server configuration.

## Goals
- Keep the client clean and privacy‑oriented (no secrets, no credentials).
- Allow quick theming and layout tweaks.
- Provide stable integration points for REST and Socket.IO.

## Project Structure (client)
- `zivan-client/src/pages/`
  - `LoginPage.jsx` — login/registration screen.
  - `ChatPage.jsx` — main chat UI, message list, creating chats, presence, calls.
- `zivan-client/src/components/`
  - `MessageList.jsx` — list + composer.
  - `ChatHeader.jsx`, `CreateChatModal.jsx`, call UI components, etc.
  - `TurnSettingsModal.jsx` — optional admin UI (only shows for a configured admin user id — UI hint only).
- `zivan-client/src/hooks/`
  - `useSocket.js` — Socket.IO setup and event wiring.
  - `useSimpleCall.js` — WebRTC (ICE fetch + call flow). No secrets are embedded.
- `zivan-client/src/api/`
  - `index.js` — minimal Axios wrapper that prepends `VITE_API_URL`.
  - `authApi.js`, `chatApi.js` — typed helper calls.
- `zivan-client/src/pages/*.css` — basic styles for pages.

## Theming and UI
- Colors/spacing/fonts — adjust in CSS files under `src/pages/*.css` and component‑specific CSS.
- Components are small and composable — feel free to replace structure or add new sections.
- Keep accessibility in mind: labels for inputs, proper button semantics.

## API Integration (safe usage)
- Base URL comes from build‑time env `VITE_API_URL`.
- Auth token is read from `localStorage` and attached as a header by `src/api/index.js`.
- Do not store or hardcode any secrets in the client.
- Do not add new privileged controls without the server enforcing permissions. The client should only reflect state allowed by the backend.

### REST helpers
- See `src/api/*.js` for minimal wrappers:
  - `authApi.js`: login, register.
  - `chatApi.js`: get chats/messages, create chat, mark delivered/read.

### Realtime (Socket.IO)
- `useSocket.js` wires up connection using the token.
- Event handlers are passed as props; extend safely with new events as needed.

### WebRTC (Calls)
- `useSimpleCall.js` handles ICE config fetch and peer connection.
- No credentials are embedded; the client only receives time‑limited ICE parameters from an API endpoint.

## Environment
Create `zivan-client/.env` (example):
```
VITE_API_URL=https://zivan.ddns.net
```

## Build & Deploy (static client)
- Development: `npm run dev` (Vite dev server)
- Production build: `npm run build` → dist/
- You can host `dist/` on any static hosting (Vercel, Netlify, Nginx, etc.).

## Security Checklist
- Never commit secrets or tokens.
- Keep token lifetime short on the server; the client will re‑login as needed.
- Treat admin UI purely as a hint — actual permissions must be enforced on the backend.
- Validate all user input server‑side. The client should not assume trust.

## Code Style
- Keep components small and focused.
- Prefer hooks for shared logic.
- Use minimal logging in production; avoid printing sensitive data to the console.

## Extending the Client
- Add new pages under `src/pages/` and route from your shell app/router (if you add one).
- Add UI state (badges, unread counters, etc.) by extending `ChatPage.jsx` and related components.
- For new REST endpoints, add a function under `src/api/` and call it from your pages/components.

Happy customizing! This client is intentionally simple to help you build your own UI quickly and safely.


# ZIVAN Client API (Public Contract)

This document describes the minimal API that a third‑party web client needs to integrate with ZIVAN. Authentication is JWT‑based, passed in the `Authorization` header. No cookies are required.

All examples assume a base URL:
```
BASE=https://zivan.ddns.net
```

## Auth

- POST `${BASE}/api/auth/login`
  - Body (JSON):
    ```json
    { "login": "user1", "password": "secret" }
    ```
  - Response (200):
    ```json
    { "token": "<JWT>" }
    ```

- POST `${BASE}/api/auth/register`
  - Body (JSON):
    ```json
    { "login": "user1", "password": "secret", "displayName": "Alice" }
    ```
  - Response (201):
    ```json
    { "message": "User registered successfully", "user": {"id": 1, "login": "user1", "display_name": "Alice"} }
    ```

Include the token in subsequent requests:
```
Authorization: Bearer <JWT>
```

## Chats

- GET `${BASE}/api/chats`
  - Headers: `Authorization: Bearer <JWT>`
  - Response:
    ```json
    [
      {
        "id": 10,
        "type": "private",
        "name": null,
        "members": [
          { "id": 1, "username": "Alice", "login": "alice" },
          { "id": 2, "username": "Bob",   "login": "bob"   }
        ]
      }
    ]
    ```

- POST `${BASE}/api/chats`
  - Body:
    ```json
    { "name": "My chat", "type": "private", "memberIds": [2] }
    ```
  - Response (201):
    ```json
    { "message": "Chat created successfully", "chatId": 11 }
    ```

## Messages

- GET `${BASE}/api/messages/:chatId`
  - Response:
    ```json
    [
      { "id": 1, "chat_id": 10, "sender_id": 1, "content": "hi", "type": "text", "status": "sent", "timestamp": "2025-09-12T10:00:00Z" }
    ]
    ```

- POST `${BASE}/api/messages/:chatId/delivered`
  - Marks all incoming (not your) messages in this chat as delivered.
  - Response: `{ "updated": 3 }`

- POST `${BASE}/api/messages/:chatId/read`
  - Marks all incoming (not your) messages in this chat as read.
  - Response: `{ "updated": 3 }`

Realtime send uses Socket.IO (see below).

## WebRTC ICE (Calls)

- GET `${BASE}/api/config/ice`
  - Returns STUN/TURN configuration with time‑limited credentials (no secrets in client):
    ```json
    { "iceServers": [ {"urls": "stun:stun.l.google.com:19302"}, {"urls": "turn:host:3478", "username": "...", "credential": "..."} ] }
    ```

## Socket.IO

Connect with token:
```js
import io from 'socket.io-client';
const socket = io(BASE, {
  auth: { token: '<JWT>' },
  transports: ['websocket', 'polling']
});
```

Events:
- `newMessage` (server -> client)
  - Payload: same shape as in GET messages
- `userTyping` / `userStoppedTyping` (server -> client)
  - Payload: `{ userId: number, chatId: number }`
- `updateOnlineUsers` (server -> client)
  - Payload: `number[]` of online user ids

API over Socket.IO:
- Join room (chat):
  ```js
  socket.emit('joinRoom', chatId);
  ```
- Send message:
  ```js
  socket.emit('sendMessage', { chatId, content: 'hello', type: 'text' });
  ```
- Typing:
  ```js
  socket.emit('startTyping', { chatId });
  socket.emit('stopTyping', { chatId });
  ```
- Calls (signaling):
  - `callUser` → server relays `{ signalData, from }` to target via `hey`
  - `acceptCall` → server relays answer via `callAccepted`
  - `iceCandidate` → server relays `{ candidate }`
  - Optional renegotiation: `renegotiate` / `renegotiateAnswer`

Client listeners (examples):
```js
socket.on('hey', ({ signal, from }) => { /* setRemoteDescription(offer) */ });
socket.on('callAccepted', (answer) => { /* setRemoteDescription(answer) */ });
socket.on('iceCandidate', (candidate) => { /* addIceCandidate */ });
```

## Errors
- HTTP: standard 4xx / 5xx JSON with `message` or `error`.
- Socket.IO: specific `*Error` events (e.g., `joinRoomError`, `sendMessageError`).

## Notes
- All sensitive operations are authorized server‑side; the client only needs JWT.
- CORS: in public client mode the server allows any Origin; clients should rely on the `Authorization` header only (no cookies required).
