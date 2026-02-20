# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-02-20

### Added
- **Core Messaging:** Real-time DMs and Group Chats with Socket.io.
- **E2EE Infrastructure:** Client-side encryption/decryption using NaCl Box.
- **Security Features:** Multi-Factor Authentication (MFA), Password Reset flow, and .edu verification.
- **Privacy Controls:** Mobile number verification with opting-in for profile visibility and click-to-call links.
- **Account Management:** 14-day delayed account deletion with cancellation grace period.
- **Discovery:** School-wide student directory scoped to university domain.
- **Branding:** Automatic school name and logo retrieval based on email domain.
- **Real-time UI:** Typing indicators and Read Receipts.
- **File Sharing:** Ephemeral file sharing with auto-deletion and history view.

### Changed
- **Tech Stack Pivot:** Successfully migrated backend from FastAPI/Postgres to Node.js/Express/MongoDB to align with course requirements and BUILD_PLAN.md.
- **UI Redesign:** Complete overhaul to high-fidelity "Gold & Black" theme matching demo aesthetics.
- **WebSocket Migration:** Switched from standard WebSockets to Socket.io for improved reliability and room management.

### Fixed
- **Security:** Resolved cross-school user discovery vulnerability.
- **Performance:** Added critical database indexes for message history and user lookups.
- **UX:** Fixed blank screen on initial load due to missing tokens in demo mode.
