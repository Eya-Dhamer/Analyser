import React, { createContext, useState, useEffect } from 'react';
import { apiCall } from '../api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('accessToken'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handleLogout = () => {
            logout();
        };
        window.addEventListener('logout', handleLogout);
        return () => window.removeEventListener('logout', handleLogout);
    }, []);

    useEffect(() => {
        if (token) {
            apiCall('/auth/me')
                .then((r) => r.json())
                .then((data) => {
                    if (data.user) setUser(data.user);
                    else logout();
                })
                .catch(logout)
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = (newAccessToken, userData) => {
        localStorage.setItem('accessToken', newAccessToken);
        setToken(newAccessToken);
        setUser(userData);
    };

    const logout = async () => {
        try {
            await apiCall('/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Error on logout:', err);
        }
        localStorage.removeItem('accessToken');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
