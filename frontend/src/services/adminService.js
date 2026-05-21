import { apiCall } from '../api';


export const adminService = {
    async getAllUsers(search = '', role = '') {
        let query = new URLSearchParams();
        if (search) query.append('search', search);
        if (role) query.append('role', role);

        const res = await apiCall(`/admin/users?${query.toString()}`, { method: 'GET' });

        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },

    async createUser(name, email, password, role) {
        const res = await apiCall('/admin/users', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create user');
        }

        return res.json();
    },

    async updateUserRole(id, role) {
        const res = await apiCall(`/admin/users/${id}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
        });

        if (!res.ok) throw new Error('Failed to update user role');
        return res.json();
    },

    async deleteUser(id) {
        const res = await apiCall(`/admin/users/${id}`, { method: 'DELETE' });

        if (!res.ok) throw new Error('Failed to delete user');
        return res.json();
    },

    async getAllAnalyses(search = '', status = '') {
        let query = new URLSearchParams();
        if (search) query.append('search', search);
        if (status) query.append('status', status);

        const res = await apiCall(`/admin/analyses?${query.toString()}`, { method: 'GET' });

        if (!res.ok) throw new Error('Failed to fetch analyses');
        return res.json();
    },

    async getUserAnalyses(userId) {
        const res = await apiCall(`/admin/users/${userId}/analyses`, { method: 'GET' });

        if (!res.ok) throw new Error('Failed to fetch user analyses');
        return res.json();
    },

    async getStats() {
        const res = await apiCall('/admin/stats', { method: 'GET' });

        if (!res.ok) throw new Error('Failed to fetch statistics');
        return res.json();
    },
};

export default adminService;
