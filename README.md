# Campus Connect

**Campus Connect** is a secure, real-time messaging platform designed exclusively for college students. It provides a private communication channel where identity is verified via university email, and all messages are protected with end-to-end encryption (E2EE).

## 🚀 Features

### 🛡️ Security & Privacy
- **End-to-End Encryption:** Messages and files are encrypted client-side using NaCl Box (Curve25519 + XSalsa20-Poly1305). The server never sees plaintext.
- **.edu Verified Identity:** Restricted to students with valid university email addresses.
- **Multi-Factor Authentication (MFA):** Optional secondary security layer for account protection.
- **Ephemeral File Sharing:** Shared files auto-delete after all recipients download them or after 24 hours.
- **14-Day Account Deletion:** Grace period for account removal with easy cancellation.

### 💬 Messaging
- **Direct Messages & Group Chats:** School-scoped discovery and communication.
- **Real-Time Communication:** Instant delivery using Socket.io.
- **Read Receipts & Typing Indicators:** Live presence and engagement cues.
- **Shared Files History:** Dedicated view for all assets shared in a conversation.

### 🏫 University Integration
- **School Directory:** Browse and connect with verified students at your institution.
- **Branded Experience:** Institutional names and logos automatically integrated based on email domain.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Zustand, TweetNaCl.js, Socket.io Client.
- **Backend:** Node.js, Express.js, Socket.io, Mongoose.
- **Database:** MongoDB (Persistent data), Redis (Rate limiting & caching).
- **Infrastructure:** Docker Compose, Helmet (Security headers), Winston (Structured logging).

---

## 🚦 Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/raybedford/campus-connect.git
   cd campus-connect
   ```

2. **Start Infrastructure (MongoDB + Redis):**
   ```bash
   docker-compose up -d
   ```

3. **Setup Backend:**
   ```bash
   cd backend
   npm install
   # Seed demo data (Alex, Sarah, Jake at Colorado Technical University)
   node seed.js
   npm run dev
   ```

4. **Setup Frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

5. **Access the App:**
   Open `http://localhost:5173` in your browser.

---

## 🧪 Demo Mode
The application currently includes an **Auth Bypass** for development and evaluation. By default, you will be authenticated as **Alex Johnson** from **Colorado Technical University**. You can explore the pre-seeded conversations and the study group immediately.

---

## 📜 License
Internal Project - Colorado Technical University.
