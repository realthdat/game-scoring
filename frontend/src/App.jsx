import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import RoomList from './pages/RoomList';
import Room from './pages/Room';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <RoomList />
          </PrivateRoute>
        }
      />
      <Route path="/room/:roomId" element={<Room />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppLayout() {
  return (
    <>
      <main style={{ flex: 1 }}>
        <AppRoutes />
      </main>
      <footer className="app-footer">
        © Copyright 2026 by DatDev
      </footer>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-root">
        <AppLayout />
      </div>
    </AuthProvider>
  );
}
