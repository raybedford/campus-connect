import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import { useAuthStore } from './store/auth';
import { useNotifications } from './hooks/useNotifications';
import './App.css';

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Signup = lazy(() => import('./pages/Signup'));
const ConversationList = lazy(() => import('./pages/ConversationList'));
const Chat = lazy(() => import('./pages/Chat'));
const NewConversation = lazy(() => import('./pages/NewConversation'));
const Directory = lazy(() => import('./pages/Directory'));
const Settings = lazy(() => import('./pages/Settings'));
const KeyTransferPair = lazy(() => import('./pages/KeyTransferPair'));

// Loading fallback component
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--cream)'
    }}>
      <div style={{
        fontSize: '2rem',
        color: 'var(--gold)',
        animation: 'pulse 1.5s ease-in-out infinite'
      }}>
        Loading...
      </div>
    </div>
  );
}

function AppRoutes() {
  const initializeAuth = useAuthStore(s => s.initialize);
  
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Global notification listener (self-guards on auth state)
  useNotifications();

  return (
    <>
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/pair"
            element={
              <ProtectedRoute>
                <KeyTransferPair />
              </ProtectedRoute>
            }
          />
          <Route
            path="/directory"
            element={
              <ProtectedRoute>
                <Directory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations"
            element={
              <ProtectedRoute>
                <ConversationList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations/new"
            element={
              <ProtectedRoute>
                <NewConversation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations/:id"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/conversations" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
