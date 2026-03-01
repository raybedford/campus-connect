import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import { useAuthStore } from './store/auth';
import { useNotifications } from './hooks/useNotifications';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Signup from './pages/Signup';
import ConversationList from './pages/ConversationList';
import Chat from './pages/Chat';
import NewConversation from './pages/NewConversation';
import Directory from './pages/Directory';
import Settings from './pages/Settings';
import './App.css';

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
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/signup" element={<Signup />} />
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
