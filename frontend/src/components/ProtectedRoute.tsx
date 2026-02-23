import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuthStore();

  // Wait for session to be restored from storage
  if (!isInitialized) {
    return (
      <div className="page page-center">
        <div style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>Restoring Session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
