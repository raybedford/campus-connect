import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notification';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAuthenticated, logout } = useAuthStore();
  const { notifications, unreadCount, clearForConversation, clearAll } = useNotificationStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close bell dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isAuthPage = ['/login', '/signup'].includes(location.pathname);

  const schoolName = profile?.school?.name || 'Colorado Technical University';
  const schoolLogo = profile?.school?.logo_url;

  const navTo = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav className="nav">
        <div className="nav-container">
          {/* Left: App Name */}
          <div className="nav-left">
            <div className="nav-logo" onClick={() => navTo('/conversations')}>
              Campus Connect
            </div>
          </div>

          {/* Center: School Affiliation (desktop only) */}
          <div className="nav-center">
            {isAuthenticated && (
              <div className="school-affiliation">
                {schoolLogo && schoolLogo.startsWith('http') && (
                  <img
                    src={schoolLogo}
                    alt={schoolName}
                    className="school-logo-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="school-info-stack">
                  <span className="school-name-text">{schoolName}</span>
                  <div className="auth-status-indicator">
                    <span className="status-dot"></span>
                    Verified Student
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Desktop links + Mobile hamburger */}
          <div className="nav-right">
            {!isAuthPage && (
              <>
                {/* Desktop navigation */}
                <div className="nav-links">
                  {isAuthenticated ? (
                    <>
                      <button onClick={() => navTo('/conversations/new')} className="btn-nav-gold">
                        <span className="desktop-text">+ New Chat</span>
                        <span className="mobile-text">+</span>
                      </button>
                      <div className="notif-bell-wrapper" ref={bellRef}>
                        <button
                          className="notif-bell-btn"
                          onClick={() => setBellOpen(!bellOpen)}
                          title="Notifications"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                          </svg>
                          {unreadCount > 0 && (
                            <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                          )}
                        </button>
                        {bellOpen && (
                          <div className="notif-dropdown">
                            <div className="notif-dropdown-header">
                              <span>Notifications</span>
                              {unreadCount > 0 && (
                                <button onClick={() => clearAll()} className="notif-clear-btn">Clear all</button>
                              )}
                            </div>
                            {notifications.length === 0 ? (
                              <div className="notif-empty">No new notifications</div>
                            ) : (
                              <div className="notif-list">
                                {notifications.slice(0, 10).map((n) => (
                                  <button
                                    key={n.id}
                                    className="notif-item"
                                    onClick={() => {
                                      clearForConversation(n.conversationId);
                                      setBellOpen(false);
                                      navTo(`/conversations/${n.conversationId}`);
                                    }}
                                  >
                                    <div className="notif-item-title">
                                      {n.isGroup ? n.conversationLabel : n.senderName}
                                    </div>
                                    <div className={`notif-item-body ${n.isMention ? 'notif-mention' : ''}`}>
                                      {n.isMention
                                        ? `${n.senderName} mentioned you`
                                        : n.isGroup
                                          ? `${n.senderName} sent a message`
                                          : 'Sent you a new message'}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <button onClick={() => navTo('/conversations')}>Messages</button>
                      <button onClick={() => navTo('/directory')}>Directory</button>
                      <button onClick={() => navTo('/settings')}>Settings</button>
                      <button onClick={() => { logout(); navTo('/login'); }}>Logout</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => navTo('/login')}>Login</button>
                      <button onClick={() => navTo('/signup')} className="btn-nav-gold">Join Now</button>
                    </>
                  )}
                </div>

                {/* Mobile hamburger */}
                <button
                  className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Menu"
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {!isAuthPage && (
        <div className={`nav-mobile-menu ${menuOpen ? 'open' : ''}`}>
          {isAuthenticated ? (
            <>
              <button onClick={() => navTo('/conversations')}>Messages</button>
              <button onClick={() => navTo('/conversations/new')}>New Chat</button>
              <button onClick={() => navTo('/directory')}>School Directory</button>
              <button onClick={() => navTo('/settings')}>Settings</button>
              <button onClick={() => { logout(); navTo('/login'); }} style={{ color: 'var(--error)' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navTo('/login')}>Login</button>
              <button onClick={() => navTo('/signup')}>Join Now</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
