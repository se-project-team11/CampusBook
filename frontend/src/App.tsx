import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { SearchPage } from './pages/SearchPage';
import { ResourceDetailPage } from './pages/ResourceDetailPage';
import { BookingConfirmation } from './pages/BookingConfirmation';
import { StudentDashboard } from './pages/StudentDashboard';
import type { ReactNode } from 'react';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout><SearchPage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/resources/:id" element={
        <PrivateRoute>
          <Layout><ResourceDetailPage /></Layout>
        </PrivateRoute>
      } />
      <Route path="/confirmation" element={
        <PrivateRoute>
          <Layout><BookingConfirmation /></Layout>
        </PrivateRoute>
      } />
      <Route path="/dashboard" element={
        <PrivateRoute>
          <Layout><StudentDashboard /></Layout>
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
