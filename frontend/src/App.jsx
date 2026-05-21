import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import Header from './components/Header.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Personal from './pages/Personal.jsx';
import Historique from './pages/Historique.jsx';
import Analyzer from './pages/Analyzer.jsx';
import Results from './pages/Results.jsx';
import SharedResult from './pages/SharedResult.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { AuthProvider, AuthContext } from './context/AuthContext';

function useAuth() {
    return useContext(AuthContext);
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" /></div>;
  
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/analyze" replace />} />
        <Route path="/login" element={user ? <Navigate to="/analyze" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/analyze" replace /> : <Register />} />
        <Route path="/dashboard" element={<PrivateRoute><Navigate to="/personal" replace /></PrivateRoute>} />
        <Route path="/personal" element={<PrivateRoute><Personal /></PrivateRoute>} />
        <Route path="/historique" element={<PrivateRoute><Historique /></PrivateRoute>} />
        <Route path="/analyze" element={<Analyzer />} />
        <Route path="/results/:id" element={<Results />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/shared/:token" element={<SharedResult />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

export { useAuth };