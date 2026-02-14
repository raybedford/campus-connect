import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useWebSocket } from './hooks/useWebSocket';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Verify from './pages/Verify';
import ConversationList from './pages/ConversationList';
import Chat from './pages/Chat';
import NewConversation from './pages/NewConversation';
import Settings from './pages/Settings';
import './App.css';

function AppRoutes() {
  useWebSocket();
  return (
    <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<Verify />} />
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
