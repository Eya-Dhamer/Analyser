import { apiCall } from '../api';


export const analysisService = {
    async guestAnalysis(configContent) {
        const res = await apiCall('/analysis/guest', {
            method: 'POST',
            body: JSON.stringify({ configContent }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Guest analysis failed');
        }

        return res.json();
    },

    async submitAnalysis(configName, configContent) {
        const res = await apiCall('/analysis/submit', {
            method: 'POST',
            body: JSON.stringify({ configName, configContent }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Analysis submission failed');
        }

        return res.json();
    },

    async getUserAnalyses(search = '', status = '') {
        let query = new URLSearchParams();
        if (search) query.append('search', search);
        if (status) query.append('status', status);

        const res = await apiCall(`/analysis?${query.toString()}`, { method: 'GET' });

        if (!res.ok) throw new Error('Failed to fetch analyses');
        return res.json();
    },

    async getAnalysis(id) {
        const res = await apiCall(`/analysis/${id}`, { method: 'GET' });

        if (!res.ok) {
            if (res.status === 404) throw new Error('Analysis not found');
            throw new Error('Failed to fetch analysis');
        }

        return res.json();
    },

    async getSharedAnalysis(token) {
        const res = await apiCall(`/analysis/shared/${token}`, { method: 'GET' });

        if (!res.ok) {
            if (res.status === 404) throw new Error('Shared analysis not found');
            throw new Error('Failed to fetch shared analysis');
        }

        return res.json();
    },

    async shareAnalysis(id) {
        const res = await apiCall(`/analysis/${id}/share`, { method: 'POST' });

        if (!res.ok) throw new Error('Failed to share analysis');
        return res.json();
    },

    async deleteAnalysis(id) {
        const res = await apiCall(`/analysis/${id}`, { method: 'DELETE' });

        if (!res.ok) throw new Error('Failed to delete analysis');
        return res.json();
    },
};

export default analysisService;
