const User = require('../models/User');
const Analysis = require('../models/Analysis');

const getStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalAnalyses = await Analysis.countDocuments();
        const completedAnalyses = await Analysis.countDocuments({ status: 'completed' });
        const failedAnalyses = await Analysis.countDocuments({ status: 'failed' });
        const pendingAnalyses = await Analysis.countDocuments({ status: 'pending' });

        const analysesWithErrors = await Analysis.countDocuments({
            status: 'completed',
            'results.errors.0': { $exists: true },
        });
        const errorDetectionRate =
            completedAnalyses > 0 ? Math.round((analysesWithErrors / completedAnalyses) * 100) : 0;

        const analysesWithVulns = await Analysis.countDocuments({
            status: 'completed',
            'results.vulnerabilities.0': { $exists: true },
        });
        const vulnDetectionRate =
            completedAnalyses > 0 ? Math.round((analysesWithVulns / completedAnalyses) * 100) : 0;

        res.json({
            totalUsers,
            totalAnalyses,
            completedAnalyses,
            failedAnalyses,
            pendingAnalyses,
            errorDetectionRate,
            vulnDetectionRate,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getStats,
};
