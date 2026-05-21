import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { Hexagon, Layout, Shield, Search, LogOut, User } from 'lucide-react';
import './Header.css';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-inner">
        <NavLink to="/analyze" className="header-logo">
          <Hexagon className="logo-icon" size={24} style={{ color: 'var(--accent)' }} />
          <span className="logo-text">NetAnalyzer</span>
        </NavLink>

        <nav className="header-nav">
          {user && (
            <NavLink to="/personal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Layout size={16} /> Personal
            </NavLink>
          )}
          {user && (
            <NavLink to="/historique" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Layout size={16} /> Historique
            </NavLink>
          )}
          <NavLink to="/analyze" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Search size={16} /> Analyze
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Shield size={16} /> Admin
            </NavLink>
          )}
        </nav>

        <div className="header-user">
          {user ? (
            <>
              <div className="user-info">
                <div className="user-avatar"><User size={16} /></div>
                <div className="user-details">
                  <span className="user-name">{user.name}</span>
                  <span className={`user-role badge ${user.role === 'admin' ? 'badge-critical' : 'badge-pending'}`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
              Login / Sign Up
            </button>
          )}
        </div>
      </div>
    </header>
  );
}