import { apiCall } from '../api';


export const authService = {
    async register(name, email, password) {
        const res = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Registration failed');
        }

        return res.json();
    },

    async login(email, password) {
        const res = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Login failed');
        }

        return res.json();
    },

    async getMe() {
        const res = await apiCall('/auth/me', { method: 'GET' });

        if (!res.ok) throw new Error('Failed to get user info');
        return res.json();
    },

    async logout() {
        const res = await apiCall('/auth/logout', { method: 'POST' });

        if (!res.ok) throw new Error('Logout failed');
        return res.json();
    },
};

export default authService;
