# Campus Connect — Build Plan [MIGRATED TO SUPABASE]

## 1. Project Overview
**Campus Connect** is a secure, real-time messaging platform designed exclusively for college students. Users sign up with their `.edu` email address, verify their identity, and can instantly message anyone at their school. All messages are end-to-end encrypted (E2EE).

The project was originally built on Node.js/Express and MongoDB, but has been migrated to **Supabase** for improved scalability, simpler real-time handling (Postgres Changes/Broadcast), and built-in Auth/Storage.

---

## 2. Tech Stack [VERIFIED]

| Layer | Technology | Status |
|-------|-----------|--------|
| **Backend** | Supabase (PostgreSQL + RLS) | ✅ |
| **Real-time** | Supabase Realtime (Postgres Changes & Broadcast) | ✅ |
| **Auth** | Supabase Auth (JWT + MFA) | ✅ |
| **Storage** | Supabase Storage (E2EE files) | ✅ |
| **Frontend** | React 18 + TS + Vite | ✅ |
| **Encryption** | TweetNaCl.js (NaCl Box) | ✅ |

---

## 3. Implementation Status

### Phase 1: Supabase Migration [COMPLETE]
- [x] Schema migration to PostgreSQL.
- [x] RLS policies replacing Node.js API logic.
- [x] Automatic profile and school creation via Postgres triggers.

### Phase 2: Frontend E2EE & Real-Time [COMPLETE]
- [x] Integration with Supabase Auth.
- [x] NaCl Box client-side encryption.
- [x] Real-time message subscription and automated decryption.
- [x] Presence (Online status) and Typing Indicators via Supabase Broadcast.

### Phase 3: Polish & Maintenance [ONGOING]
- [x] Standardized timestamp handling.
- [x] Cleaned up legacy Node/Mongo/FastAPI code.
- [x] Updated documentation and environment setup.

---

## 4. Final Deliverable
A serverless, E2EE-secured messaging ecosystem for Colorado Technical University, leveraging Supabase for high availability and low maintenance.
