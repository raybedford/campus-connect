# Campus Connect

**Campus Connect** is a secure, real-time messaging platform designed exclusively for college students. It provides a private communication channel where identity is verified via university email, and all messages are protected with end-to-end encryption (E2EE).

## 🚀 Features

### 🛡️ Security & Privacy
- **End-to-End Encryption:** Messages and files are encrypted client-side using NaCl Box (Curve25519 + XSalsa20-Poly1305). The server never sees plaintext.
- **.edu Verified Identity:** Restricted to students with valid university email addresses.
- **Multi-Factor Authentication (MFA):** Managed via Supabase Auth.
- **Ephemeral File Sharing:** Shared files stored in Supabase Storage with E2EE.

### 💬 Messaging
- **Direct Messages & Group Chats:** School-scoped discovery and communication.
- **Real-Time Communication:** Instant delivery using Supabase Realtime (Postgres Changes & Broadcast).
- **Read Receipts & Typing Indicators:** Live presence and engagement cues.
- **Translation:** Integrated translation for multilingual campus environments.

### 🏫 University Integration
- **School Directory:** Browse and connect with verified students at your institution.
- **Automatic School Association:** Institutional names and logos automatically integrated based on email domain via database triggers.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Zustand, TweetNaCl.js.
- **Backend/Database:** Supabase (PostgreSQL, Auth, Storage, Realtime).
- **Infrastructure:** Vercel (Frontend), Supabase (Backend).

---

## 🚦 Getting Started

### Prerequisites
- [Supabase Account](https://supabase.com/)
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/raybedford/campus-connect.git
   cd campus-connect
   ```

2. **Supabase Database Setup:**
   - Create a new Supabase project.
   - Run the SQL in `supabase/schema.sql` in the Supabase SQL Editor.
   - Create a bucket named `chat-files` in Supabase Storage and set its privacy to 'Public' (access is still restricted via RLS).

3. **Frontend Setup:**
   ```bash
   cd frontend
   cp .env.example .env
   # Update .env with your Supabase Project URL and Anon Key
   npm install
   npm run dev
   ```

4. **Access the App:**
   Open `http://localhost:5173` in your browser.

---

## 📜 License
Internal Project - Colorado Technical University.
