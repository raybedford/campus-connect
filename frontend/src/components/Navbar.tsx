import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAuthenticated, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

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
