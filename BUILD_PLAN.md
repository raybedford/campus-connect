# Campus Connect — Build Plan

## 1. Project Overview

**Campus Connect** is a secure, real-time messaging platform designed exclusively for college students. Users sign up with their `.edu` email address, verify their identity, and can instantly message anyone at their school. All messages are end-to-end encrypted (E2EE), ensuring that neither the server nor any third party can read message content. Shared files are encrypted client-side and automatically deleted from the server once all recipients have downloaded them.

The application is built as a responsive web app with a mobile-first design, wrappable with Capacitor for native iOS/Android distribution.

---

## 2. Problem Statement

College students need a dedicated, private communication channel scoped to their university. Existing platforms (GroupMe, Discord, iMessage) lack:

- **School-scoped identity** — no way to verify someone is actually a student
- **End-to-end encryption by default** — most platforms can read your messages
- **Ephemeral file sharing** — shared files persist indefinitely on most platforms
- **A focused, distraction-free experience** — no ads, no algorithmic feeds

Campus Connect solves each of these.

---

## 3. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend** | Node.js + Express.js | Course-required runtime; fast async I/O, massive ecosystem |
| **Real-time** | Socket.io | Course-required; rooms, namespaces, automatic reconnection |
| **Database** | MongoDB | Course-required; flexible document store for encrypted payloads |
| **ODM** | Mongoose | Schema validation and model layer for MongoDB |
| **Cache / Sessions** | Redis | Course-required; session store, rate-limit counters, presence cache |
| **Frontend** | React 18 + TypeScript + Vite | Modern, type-safe UI with fast HMR development |
| **State Management** | Zustand | Lightweight, minimal boilerplate state management |
| **Encryption (client)** | TweetNaCl.js | Audited NaCl implementation — `nacl.box` (Curve25519 + XSalsa20-Poly1305) |
| **Mobile** | Capacitor | Wrap the web app as native iOS/Android without rewriting |
| **Dev Infrastructure** | Docker Compose | Containerized MongoDB + Redis for consistent local development |

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Client (React)                       │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Zustand  │  │ TweetNaCl  │  │  Axios   │  │Socket.io│ │
│  │ Stores   │  │ Encryption │  │  + JWT   │  │ Client  │ │
│  └─────────┘  └────────────┘  └──────────┘  └─────────┘ │
└──────────────────────┬───────────────┬───────────────────┘
                       │ HTTPS         │ WSS
┌──────────────────────┴───────────────┴───────────────────┐
│              Express.js + Socket.io Server                 │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  REST     │  │  Socket.io │  │  Background Tasks    │  │
│  │  Routes   │  │  Handlers  │  │  (file cleanup)      │  │
│  └──────────┘  └────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Services Layer                           │ │
│  │  auth | user | conversation | message | file | key    │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────┬───────────────────┘
               │ mongoose              │ ioredis
┌──────────────┴──────────┐  ┌─────────┴──────────────────┐
│        MongoDB           │  │          Redis              │
│  schools | users | convos│  │  sessions | presence | rate │
│  messages | files | keys │  │  limits | pub/sub           │
└──────────────────────────┘  └────────────────────────────┘
```

---

## 5. Database Schema (Mongoose / MongoDB)

### School
```js
{
  domain:     { type: String, unique: true },  // e.g. "coloradotech.edu"
  name:       { type: String },
  createdAt:  { type: Date, default: Date.now }
}
```

### User
```js
{
  email:                { type: String, unique: true },
  displayName:          { type: String, required: true },
  passwordHash:         { type: String },  // bcrypt
  school:               { type: ObjectId, ref: 'School' },
  isVerified:           { type: Boolean, default: false },
  verificationCode:     { type: String },  // 6-digit
  verificationExpires:  { type: Date },    // 10 min TTL
  createdAt:            { type: Date, default: Date.now },
  lastSeen:             { type: Date }
}
```

### PublicKey
```js
{
  user:         { type: ObjectId, ref: 'User' },
  keyType:      { type: String, default: 'x25519' },
  publicKeyB64: { type: String },  // 32-byte Curve25519, base64
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now }
}
```

### Conversation
```js
{
  type:      { type: String, enum: ['dm', 'group'] },
  name:      { type: String },  // null for DMs
  school:    { type: ObjectId, ref: 'School' },
  createdBy: { type: ObjectId, ref: 'User' },
  members:   [{
    user:       { type: ObjectId, ref: 'User' },
    joinedAt:   { type: Date, default: Date.now },
    lastReadAt: { type: Date }
  }],
  createdAt: { type: Date, default: Date.now }
}
// Compound index on members.user + type for DM dedup
```

### Message
```js
{
  conversation:      { type: ObjectId, ref: 'Conversation' },
  sender:            { type: ObjectId, ref: 'User' },
  messageType:       { type: String, enum: ['text', 'file'] },
  encryptedPayloads: [{
    recipientId:   String,
    ciphertextB64: String,
    nonceB64:      String
  }],
  createdAt:         { type: Date, default: Date.now }
}
```

### FileAttachment
```js
{
  message:          { type: ObjectId, ref: 'Message' },
  originalFilename: { type: String },
  storedFilename:   { type: String },  // UUID-based
  fileSizeBytes:    { type: Number },   // Max 10MB
  mimeType:         { type: String },
  totalRecipients:  { type: Number },
  downloads:        [{
    user:         { type: ObjectId, ref: 'User' },
    downloadedAt: { type: Date, default: Date.now }
  }],
  isDeleted:        { type: Boolean, default: false },
  createdAt:        { type: Date, default: Date.now }
}
```

---

## 6. Core Features

### 6.1 Authentication
- Signup requires a valid `.edu` email address
- Server extracts the domain (e.g. `coloradotech.edu`) and auto-creates or links to a School record
- 6-digit verification code sent to email (dev mode: logged to console)
- Code expires after 10 minutes
- On verification, server returns JWT access token (30 min) and refresh token (7 days)
- Token refresh endpoint rotates both tokens
- Rate limiting: 10 requests/minute per IP on all auth endpoints

### 6.2 School-Scoped User Discovery
- Users can search for other students at their school by name
- Search is scoped to the same `school_id` — you cannot discover users at other universities
- Results return display name and email for starting conversations

### 6.3 Conversations
- **Direct Messages (DMs):** One-to-one conversations, deduplicated (only one DM between any two users)
- **Group Chats:** Named conversations with multiple members from the same school
- Conversation list shows all conversations with member previews

### 6.4 Real-Time Messaging (Socket.io)
- Client connects via Socket.io with JWT in `auth` handshake
- Server validates JWT middleware and joins user to Socket.io rooms for their conversations
- **Client → Server:** `send_message`, `typing`, `read_receipt`
- **Server → Client:** `new_message`, `user_typing`, `presence`, `message_ack`
- Messages are persisted to MongoDB and broadcast to room members via Socket.io
- Offline users load message history via REST on next connection
- Socket.io handles automatic reconnection with backoff

### 6.5 End-to-End Encryption
- **Algorithm:** NaCl Box — Curve25519 key exchange + XSalsa20-Poly1305 authenticated encryption
- **Key generation:** Client generates `nacl.box.keyPair()` after email verification
- **Private key storage:** IndexedDB via `idb-keyval` — never leaves the device
- **Public key:** Uploaded to server via `POST /keys/publish`
- **Sending:** Sender fetches recipient's public key, encrypts with `nacl.box(message, nonce, recipientPK, senderSK)`. For groups, encrypts once per member.
- **Receiving:** Recipient finds their payload by `recipient_id`, decrypts with `nacl.box.open(ciphertext, nonce, senderPK, recipientSK)`
- **Server sees:** sender ID, conversation ID, timestamp. **Server never sees:** plaintext.

### 6.6 Ephemeral File Sharing
1. Client encrypts file with `nacl.secretbox` (random symmetric key)
2. Client encrypts the symmetric key per-recipient with `nacl.box`
3. Encrypted blob uploaded via `POST /files/upload` (max 10MB)
4. File message sent via WebSocket with encrypted key payloads
5. Recipients download via `GET /files/{id}/download`, server tracks each download
6. When all recipients have downloaded → file is automatically deleted from disk
7. Background cleanup task deletes any files older than 24 hours as a safety net

### 6.7 Presence & Typing Indicators
- Online/offline status broadcast to conversation members on WebSocket connect/disconnect
- Typing indicators sent as WebSocket events, auto-clear after 3 seconds

---

## 7. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register with .edu email |
| POST | `/auth/verify` | Verify email with 6-digit code |
| POST | `/auth/login` | Login, receive JWT tokens |
| POST | `/auth/refresh` | Rotate access + refresh tokens |
| GET | `/users/me` | Get current user profile |
| PATCH | `/users/me` | Update display name |
| GET | `/users/search?q=` | Search users at same school |
| POST | `/keys/publish` | Upload public encryption key |
| GET | `/keys/{user_id}` | Get user's active public key |
| GET | `/keys/batch?user_ids=` | Batch fetch public keys |
| POST | `/conversations` | Create DM or group conversation |
| GET | `/conversations` | List user's conversations |
| GET | `/conversations/{id}` | Get conversation with members |
| POST | `/conversations/{id}/members` | Add member to group |
| DELETE | `/conversations/{id}/members/{uid}` | Remove member |
| GET | `/conversations/{id}/messages` | Message history (cursor-based) |
| POST | `/files/upload` | Upload encrypted file blob |
| GET | `/files/{id}/download` | Download file (tracks recipient) |
| WS | Socket.io (auto) | Socket.io connection with JWT auth handshake |

---

## 8. Security Design

| Threat | Mitigation |
|--------|-----------|
| Server compromise | E2EE — server stores only encrypted blobs, never plaintext |
| Man-in-the-middle | TLS for all connections; NaCl authenticated encryption prevents tampering |
| Brute-force auth | Rate limiting (10 req/min per IP) on signup/login/verify |
| Token theft | Short-lived access tokens (30 min), refresh rotation |
| File persistence | Auto-delete after all downloads + 24hr safety-net cleanup |
| Cross-school stalking | User search scoped to same school_id |
| XSS/injection | React auto-escapes output; Mongoose parameterized queries |
| Private key exfiltration | Keys stored in IndexedDB, never transmitted to server |

**Accepted tradeoff:** NaCl Box does not provide per-message forward secrecy (unlike Signal Protocol). If a device's private key is compromised, past messages for that key can be decrypted. This tradeoff was chosen for implementation simplicity while still providing strong authenticated encryption.

---

## 9. Five-Week Implementation Plan

### Week 1: Foundation + Authentication
**Goal:** Stand up the backend, database, and complete auth system.

| Day | Tasks |
|-----|-------|
| Tue | Project scaffolding: Docker Compose (MongoDB + Redis), `.gitignore`, backend directory structure, `package.json`, config module |
| Wed | Database layer: Mongoose connection, User and School models with validation |
| Thu | Security module (JWT encode/decode with jsonwebtoken, bcrypt hashing), Redis session setup |
| Fri | Auth service: signup (.edu validation, school auto-creation, verification code), verify, login, refresh token rotation |
| Sat | Auth routes + email service (dev: console logging), JWT auth middleware, `/users/me` endpoint |
| **Sun** | **Verification + submission** |

**Deliverable:** Complete auth flow via curl — signup → verify (code from console) → login → `/users/me`

**Verification:** Run `node server.js` (or `npm run dev`), test all auth endpoints with curl, inspect database with `mongosh`

---

### Week 2: Conversations, User Discovery + Frontend
**Goal:** Users can find each other, create conversations, and interact through a React frontend.

| Day | Tasks |
|-----|-------|
| Tue | Conversation Mongoose model (embedded members array), conversation validation |
| Wed | Conversation service: create DM (with dedup), create group, list conversations, get conversation, add/remove members |
| Thu | Conversation routes, school-scoped user search endpoint (`GET /users/search?q=`) |
| Fri | Frontend init: Vite + React 18 + TypeScript, install dependencies (react-router-dom, zustand, axios, tweetnacl, idb-keyval, socket.io-client, @capacitor/core), Zustand stores (auth, conversation, message, presence) |
| Sat | Frontend pages: Login, Signup, Verify, ConversationList, NewConversation, Settings. API client with JWT interceptor + auto-refresh. ProtectedRoute component. |
| **Sun** | **Verification + submission** |

**Deliverable:** Two users can sign up in the browser, search for each other, and create a DM conversation

**Verification:** Full browser walkthrough — signup both users, search, create conversation, see it in list

---

### Week 3: Real-Time Messaging
**Goal:** Users can send and receive messages in real time via WebSockets.

| Day | Tasks |
|-----|-------|
| Tue | Message Mongoose model (encryptedPayloads array), message validation |
| Wed | Message service: create message (membership validation), get messages (cursor-based pagination). REST history endpoint. |
| Thu | Socket.io setup: server integration with Express, JWT auth middleware, room management per conversation |
| Fri | Socket.io handlers: `send_message` (persist + broadcast to room), `typing` (broadcast to members), `read_receipt`, presence via connect/disconnect events, Redis adapter for pub/sub |
| Sat | Frontend Chat page: MessageBubble, MessageInput, TypingIndicator components. Socket.io client hook integrated into App. |
| **Sun** | **Verification + submission** |

**Deliverable:** Two users can chat in real time — messages appear instantly, typing indicators work, online presence shows

**Verification:** Open two browser tabs, send messages both directions, verify real-time delivery and typing indicators

---

### Week 4: End-to-End Encryption + File Sharing
**Goal:** All messages are encrypted client-side. Files can be shared securely and auto-delete.

| Day | Tasks |
|-----|-------|
| Tue | PublicKey Mongoose model, key service (publish with validation, get active, batch get), key routes |
| Wed | Client-side crypto: `keyManager.ts` (generate `nacl.box.keyPair()`, store in IndexedDB via idb-keyval), `encryption.ts` (`encryptForRecipient`, `encryptForMultipleRecipients`, `decryptMessage`) |
| Thu | Integrate E2EE: generate + publish keypair after verification, Chat page encrypts on send and decrypts on receive, plaintext fallback for pre-encryption messages |
| Fri | FileAttachment Mongoose model (embedded downloads array), `fileEncryption.ts` (nacl.secretbox + per-recipient key wrapping), file upload endpoint (10MB max, UUID storage) |
| Sat | File download endpoint (tracks downloads, auto-deletes when all recipients download), background cleanup task (hourly, 24h safety net), file attach button in MessageInput, FileAttachmentView component |
| **Sun** | **Verification + submission** |

**Deliverable:** Messages in the database are opaque encrypted blobs. Files are encrypted, shared, and auto-deleted after download.

**Verification:** Inspect `messages` collection — payloads are encrypted base64. Upload a file, have all recipients download it, confirm it's deleted from `backend/uploads/`

---

### Week 5: Polish, Testing + Deployment Readiness
**Goal:** Harden the application, finalize the UI, prepare for mobile, and complete documentation.

| Day | Tasks |
|-----|-------|
| Tue | Rate limiting on auth endpoints (10 req/min per IP), WebSocket reconnection with exponential backoff (1s base, 30s max) |
| Wed | CTU theming: black & gold color scheme, campus building SVG branding, centered layouts, responsive design polish |
| Thu | Capacitor configuration for iOS/Android wrapping, loading/error states across all pages, edge case handling |
| Fri | End-to-end testing: full auth flow, user search, DM + group conversations, real-time messaging, E2EE verification, file sharing lifecycle, rate limiting |
| Sat | Final documentation (BUILD_PLAN.md), code cleanup, demo preparation |
| **Sun** | **Final verification + submission** |

**Deliverable:** Production-ready application with complete documentation, tested across all features

**Verification Checklist:**
- [ ] Auth flow: signup → verify → login → /users/me
- [ ] User search returns only same-school results
- [ ] DM creation is deduplicated
- [ ] Group conversations support add/remove members
- [ ] Socket.io: messages, typing, presence all work in real time
- [ ] Messages in DB are encrypted (inspect encryptedPayloads array)
- [ ] Public keys publish and retrieve correctly
- [ ] File upload, encrypted download, and auto-delete work
- [ ] Rate limiting returns 429 after threshold
- [ ] Socket.io reconnects after disconnect
- [ ] UI renders correctly on mobile viewport
- [ ] All pages load without console errors

---

## 10. Project Structure

```
campus-connect/
├── docker-compose.yml
├── .gitignore
├── BUILD_PLAN.md
├── backend/
│   ├── package.json
│   ├── server.js              # Express + Socket.io entry point
│   ├── config/
│   │   └── index.js           # Environment config (MONGO_URI, REDIS_URL, JWT_SECRET, etc.)
│   ├── models/
│   │   ├── School.js
│   │   ├── User.js
│   │   ├── Conversation.js
│   │   ├── Message.js
│   │   ├── PublicKey.js
│   │   └── FileAttachment.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── conversations.js
│   │   ├── messages.js
│   │   ├── keys.js
│   │   └── files.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── emailService.js
│   │   ├── userService.js
│   │   ├── conversationService.js
│   │   ├── messageService.js
│   │   ├── fileService.js
│   │   └── keyService.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verification middleware
│   │   ├── rateLimiter.js     # Redis-backed rate limiting
│   │   └── errorHandler.js
│   └── socket/
│       ├── index.js           # Socket.io initialization + auth middleware
│       ├── handlers.js        # send_message, typing, read_receipt
│       └── presence.js        # Online/offline tracking via Redis
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── capacitor.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── App.css
        ├── api/
        │   ├── client.ts
        │   ├── auth.ts
        │   ├── conversations.ts
        │   ├── messages.ts
        │   ├── keys.ts
        │   └── files.ts
        ├── crypto/
        │   ├── keyManager.ts
        │   ├── encryption.ts
        │   └── fileEncryption.ts
        ├── hooks/
        │   └── useSocket.ts   # Socket.io client hook
        ├── store/
        │   ├── auth.ts
        │   ├── conversation.ts
        │   ├── message.ts
        │   └── presence.ts
        ├── pages/
        │   ├── Login.tsx
        │   ├── Signup.tsx
        │   ├── Verify.tsx
        │   ├── ConversationList.tsx
        │   ├── Chat.tsx
        │   ├── NewConversation.tsx
        │   └── Settings.tsx
        ├── components/
        │   ├── CampusBuilding.tsx
        │   ├── MessageBubble.tsx
        │   ├── MessageInput.tsx
        │   ├── FileAttachmentView.tsx
        │   ├── TypingIndicator.tsx
        │   └── ProtectedRoute.tsx
        ├── types/
        │   └── index.ts
        └── utils/
            └── edu.ts
```

---

## 11. Testing & Verification

| Test Area | Method |
|-----------|--------|
| Auth flow | curl: signup → verify (code from console) → login → `/users/me` |
| User search | curl: `GET /users/search?q=<name>` returns same-school users |
| Conversations | curl: create DM, verify dedup, create group |
| Socket.io messaging | Socket.io test client: connect, send, receive, presence, typing |
| Message history | curl: `GET /conversations/{id}/messages` returns paginated results |
| E2EE | Inspect `messages` collection — `encryptedPayloads` contains opaque base64 blobs |
| Key management | curl: publish key, get key, batch get |
| File sharing | Upload encrypted blob, download, verify auto-delete after all recipients download |
| Rate limiting | Rapid-fire auth requests — verify 429 after 10 per minute |
| Frontend | Browser testing of all pages and real-time features |

---

## 12. Future Enhancements

- **Push notifications** via Firebase Cloud Messaging (FCM) / APNs
- **Read receipts** UI (backend support already exists)
- **Message reactions**
- **Signal Protocol** upgrade for per-message forward secrecy
- **Multi-device key sync** via encrypted key backup
- **Admin dashboard** for school administrators
- **Message search** (client-side decrypted message indexing)
- **Voice/video calls** via WebRTC + Socket.io signaling
