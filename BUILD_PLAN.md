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
| **Backend** | Python FastAPI (async) | High-performance async framework, WebSocket support built-in |
| **Database** | PostgreSQL 16 | Robust relational DB, JSONB support for encrypted payloads |
| **ORM** | SQLAlchemy 2.0 (async) + asyncpg | Async-native ORM with type-safe models |
| **Migrations** | Alembic | Industry-standard schema migration tool |
| **Real-time** | Native FastAPI WebSockets | Low-latency bidirectional messaging |
| **Frontend** | React 18 + TypeScript + Vite | Modern, type-safe UI with fast HMR development |
| **State Management** | Zustand | Lightweight, minimal boilerplate state management |
| **Encryption (client)** | TweetNaCl.js | Audited NaCl implementation — `nacl.box` (Curve25519 + XSalsa20-Poly1305) |
| **Encryption (server)** | PyNaCl | Server-side key format validation only (server never decrypts) |
| **Mobile** | Capacitor | Wrap the web app as native iOS/Android without rewriting |
| **Dev Infrastructure** | Docker Compose | Containerized PostgreSQL for consistent local development |

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Client (React)                       │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Zustand  │  │ TweetNaCl  │  │  Axios   │  │WebSocket│ │
│  │ Stores   │  │ Encryption │  │  + JWT   │  │ Client  │ │
│  └─────────┘  └────────────┘  └──────────┘  └─────────┘ │
└──────────────────────┬───────────────┬───────────────────┘
                       │ HTTPS         │ WSS
┌──────────────────────┴───────────────┴───────────────────┐
│                    FastAPI Server                          │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  REST     │  │  WebSocket │  │  Background Tasks    │  │
│  │  Routers  │  │  Handler   │  │  (file cleanup)      │  │
│  └──────────┘  └────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Services Layer                           │ │
│  │  auth | user | conversation | message | file | key    │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ asyncpg
┌──────────────────────┴───────────────────────────────────┐
│                   PostgreSQL 16                            │
│  schools | users | conversations | messages | files | keys │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema

### schools
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| domain | VARCHAR | UNIQUE (e.g. "colorado.edu") |
| name | VARCHAR | Optional |
| created_at | TIMESTAMP | DEFAULT now() |

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | VARCHAR | UNIQUE |
| display_name | VARCHAR | NOT NULL |
| password_hash | VARCHAR | bcrypt |
| school_id | UUID | FK → schools |
| is_verified | BOOLEAN | DEFAULT false |
| verification_code | VARCHAR | 6-digit code |
| verification_expires | TIMESTAMP | 10 min TTL |
| created_at | TIMESTAMP | |
| last_seen | TIMESTAMP | |

### public_keys
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| key_type | VARCHAR | "x25519" |
| public_key_b64 | VARCHAR | 32-byte Curve25519, base64 |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |

### conversations
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| type | VARCHAR | "dm" or "group" |
| name | VARCHAR | NULL for DMs |
| school_id | UUID | FK → schools |
| created_by | UUID | FK → users |
| created_at | TIMESTAMP | |

### conversation_members
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| conversation_id | UUID | FK → conversations |
| user_id | UUID | FK → users |
| joined_at | TIMESTAMP | |
| last_read_at | TIMESTAMP | |
| | | UNIQUE(conversation_id, user_id) |

### messages
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| conversation_id | UUID | FK → conversations |
| sender_id | UUID | FK → users |
| created_at | TIMESTAMP | |
| message_type | VARCHAR | "text" or "file" |
| encrypted_payloads | JSONB | Array of per-recipient encrypted data |

**encrypted_payloads structure:**
```json
[
  {
    "recipient_id": "uuid",
    "ciphertext_b64": "base64-encoded encrypted message",
    "nonce_b64": "base64-encoded 24-byte nonce"
  }
]
```

### file_attachments
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| message_id | UUID | FK → messages, UNIQUE |
| original_filename | VARCHAR | |
| stored_filename | VARCHAR | UUID-based |
| file_size_bytes | INTEGER | Max 10MB |
| mime_type | VARCHAR | |
| total_recipients | INTEGER | |
| is_deleted | BOOLEAN | |
| created_at | TIMESTAMP | |

### file_downloads
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| attachment_id | UUID | FK → file_attachments |
| user_id | UUID | FK → users |
| downloaded_at | TIMESTAMP | |
| | | UNIQUE(attachment_id, user_id) |

---

## 6. Core Features

### 6.1 Authentication
- Signup requires a valid `.edu` email address
- Server extracts the domain (e.g. `colorado.edu`) and auto-creates or links to a School record
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

### 6.4 Real-Time Messaging (WebSocket)
- Client connects via `ws://host/ws?token=<JWT>`
- Server validates JWT and subscribes user to all their conversations
- **Client → Server:** `send_message`, `typing`, `read_receipt`
- **Server → Client:** `new_message`, `user_typing`, `presence`, `message_ack`
- Messages are persisted to PostgreSQL and broadcast to online members
- Offline users load message history via REST on next connection
- Exponential backoff reconnection (1s base, 30s max)

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
| WS | `/ws?token=` | WebSocket connection |

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
| XSS/injection | React auto-escapes output; parameterized SQL via SQLAlchemy |
| Private key exfiltration | Keys stored in IndexedDB, never transmitted to server |

**Accepted tradeoff:** NaCl Box does not provide per-message forward secrecy (unlike Signal Protocol). If a device's private key is compromised, past messages for that key can be decrypted. This tradeoff was chosen for implementation simplicity while still providing strong authenticated encryption.

---

## 9. Five-Week Implementation Plan

### Week 1: Foundation + Authentication
**Goal:** Stand up the backend, database, and complete auth system.

| Day | Tasks |
|-----|-------|
| Tue | Project scaffolding: Docker Compose (PostgreSQL), `.gitignore`, backend directory structure, `requirements.txt`, config module |
| Wed | Database layer: async engine + session factory, SQLAlchemy `DeclarativeBase`, User and School models |
| Thu | Alembic async migrations (initial schema), security module (JWT encode/decode, bcrypt hashing) |
| Fri | Auth service: signup (.edu validation, school auto-creation, verification code), verify, login, refresh token rotation |
| Sat | Auth router + email service (dev: console logging), `get_current_user` dependency, `/users/me` endpoint |
| **Sun** | **Verification + submission** |

**Deliverable:** Complete auth flow via curl — signup → verify (code from console) → login → `/users/me`

**Verification:** Run `uvicorn backend.app.main:app --reload`, test all auth endpoints with curl, inspect database with `psql`

---

### Week 2: Conversations, User Discovery + Frontend
**Goal:** Users can find each other, create conversations, and interact through a React frontend.

| Day | Tasks |
|-----|-------|
| Tue | Conversation and ConversationMember models + Alembic migration, conversation schemas |
| Wed | Conversation service: create DM (with dedup), create group, list conversations, get conversation, add/remove members |
| Thu | Conversation router, school-scoped user search endpoint (`GET /users/search?q=`) |
| Fri | Frontend init: Vite + React 18 + TypeScript, install dependencies (react-router-dom, zustand, axios, tweetnacl, idb-keyval, @capacitor/core), Zustand stores (auth, conversation, message, presence) |
| Sat | Frontend pages: Login, Signup, Verify, ConversationList, NewConversation, Settings. API client with JWT interceptor + auto-refresh. ProtectedRoute component. |
| **Sun** | **Verification + submission** |

**Deliverable:** Two users can sign up in the browser, search for each other, and create a DM conversation

**Verification:** Full browser walkthrough — signup both users, search, create conversation, see it in list

---

### Week 3: Real-Time Messaging
**Goal:** Users can send and receive messages in real time via WebSockets.

| Day | Tasks |
|-----|-------|
| Tue | Message model (JSONB `encrypted_payloads` column) + Alembic migration, message schemas |
| Wed | Message service: create message (membership validation), get messages (cursor-based pagination). REST history endpoint. |
| Thu | WebSocket infrastructure: `ConnectionManager` (tracks user_id → active connections), WS event schemas |
| Fri | WebSocket handler: JWT auth via query param, `send_message` (persist + broadcast), `typing` (broadcast to members), `read_receipt`, presence notifications on connect/disconnect |
| Sat | Frontend Chat page: MessageBubble, MessageInput, TypingIndicator components. `useWebSocket` hook integrated into App. |
| **Sun** | **Verification + submission** |

**Deliverable:** Two users can chat in real time — messages appear instantly, typing indicators work, online presence shows

**Verification:** Open two browser tabs, send messages both directions, verify real-time delivery and typing indicators

---

### Week 4: End-to-End Encryption + File Sharing
**Goal:** All messages are encrypted client-side. Files can be shared securely and auto-delete.

| Day | Tasks |
|-----|-------|
| Tue | PublicKey model + migration, key service (publish with validation, get active, batch get), key router |
| Wed | Client-side crypto: `keyManager.ts` (generate `nacl.box.keyPair()`, store in IndexedDB via idb-keyval), `encryption.ts` (`encryptForRecipient`, `encryptForMultipleRecipients`, `decryptMessage`) |
| Thu | Integrate E2EE: generate + publish keypair after verification, Chat page encrypts on send and decrypts on receive, plaintext fallback for pre-encryption messages |
| Fri | FileAttachment + FileDownload models + migration, `fileEncryption.ts` (nacl.secretbox + per-recipient key wrapping), file upload endpoint (10MB max, UUID storage) |
| Sat | File download endpoint (tracks downloads, auto-deletes when all recipients download), background cleanup task (hourly, 24h safety net), file attach button in MessageInput, FileAttachmentView component |
| **Sun** | **Verification + submission** |

**Deliverable:** Messages in the database are opaque encrypted blobs. Files are encrypted, shared, and auto-deleted after download.

**Verification:** Inspect `messages` table — payloads are encrypted base64. Upload a file, have all recipients download it, confirm it's deleted from `backend/uploads/`

---

### Week 5: Polish, Testing + Deployment Readiness
**Goal:** Harden the application, finalize the UI, prepare for mobile, and complete documentation.

| Day | Tasks |
|-----|-------|
| Tue | Rate limiting on auth endpoints (10 req/min per IP), WebSocket reconnection with exponential backoff (1s base, 30s max) |
| Wed | CU Boulder theming: black & gold color scheme, campus building SVG branding, centered layouts, responsive design polish |
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
- [ ] WebSocket: messages, typing, presence all work in real time
- [ ] Messages in DB are encrypted (inspect JSONB column)
- [ ] Public keys publish and retrieve correctly
- [ ] File upload, encrypted download, and auto-delete work
- [ ] Rate limiting returns 429 after threshold
- [ ] WebSocket reconnects after disconnect
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
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── security.py
│       ├── dependencies.py
│       ├── exceptions.py
│       ├── models/
│       │   ├── base.py
│       │   ├── user.py
│       │   ├── conversation.py
│       │   ├── message.py
│       │   ├── public_key.py
│       │   └── file_attachment.py
│       ├── schemas/
│       │   ├── auth.py
│       │   ├── user.py
│       │   ├── conversation.py
│       │   ├── message.py
│       │   ├── key.py
│       │   └── file.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── conversations.py
│       │   ├── messages.py
│       │   ├── files.py
│       │   └── keys.py
│       ├── services/
│       │   ├── auth_service.py
│       │   ├── email_service.py
│       │   ├── user_service.py
│       │   ├── conversation_service.py
│       │   ├── message_service.py
│       │   ├── file_service.py
│       │   └── key_service.py
│       └── ws/
│           ├── connection_manager.py
│           ├── handler.py
│           └── events.py
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
        │   └── useWebSocket.ts
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
| WebSocket messaging | Python `websockets` client: connect, send, receive, presence, typing |
| Message history | curl: `GET /conversations/{id}/messages` returns paginated results |
| E2EE | Inspect `messages` table — `encrypted_payloads` contains opaque base64 blobs |
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
- **Voice/video calls** via WebRTC
