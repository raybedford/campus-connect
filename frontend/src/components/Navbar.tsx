import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();

  // Don't show complex nav on auth pages
  const isAuthPage = ['/login', '/signup', '/verify'].includes(location.pathname);

  const schoolName = user?.school?.name || 'Colorado Technical University';
  const schoolLogo = user?.school?.logoUrl;

  return (
    <nav className="nav">
      <div className="nav-container">
        {/* Left: App Name */}
        <div className="nav-left">
          <div className="nav-logo" onClick={() => navigate('/conversations')}>
            Campus Connect
          </div>
        </div>

        {/* Center: School Affiliation */}
        <div className="nav-center">
          {isAuthenticated && (
            <div className="school-affiliation">
              {schoolLogo && (
                <img 
                  src={schoolLogo} 
                  alt={schoolName} 
                  className="school-logo-img"
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
        
        {/* Right: Links */}
        <div className="nav-right">
          {!isAuthPage && (
            <div className="nav-links">
              {isAuthenticated ? (
                <>
                  <button onClick={() => navigate('/conversations')}>Messages</button>
                  <button onClick={() => navigate('/directory')}>Directory</button>
                  <button onClick={() => navigate('/settings')}>Settings</button>
                  <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate('/login')}>Login</button>
                  <button onClick={() => navigate('/signup')} className="btn-nav-gold">Join Now</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
