const User = require('../models/User');
const Analysis = require('../models/Analysis');
const Configuration = require('../models/Configuration');


const getAllUsers = async (req, res) => {
    try {
        const { search, role } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        if (role && ['user', 'admin'].includes(role)) {
            query.role = role;
        }

        const users = await User.find(query).sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const user = new User({
            name,
            email,
            password,
            role: ['user', 'admin'].includes(role) ? role : 'user',
        });
        await user.save();
        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await Analysis.deleteMany({ userId: req.params.id });
        await Configuration.deleteMany({ userId: req.params.id });
        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'User and their analyses deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const getAllAnalyses = async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = {};

        if (search) {
            query.configName = { $regex: search, $options: 'i' };
        }

        if (status && ['pending', 'analyzing', 'completed', 'failed'].includes(status)) {
            query.status = status;
        }

        const analyses = await Analysis.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .select('-configContent');

        res.json(analyses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const getUserAnalyses = async (req, res) => {
    try {
        const userId = req.params.id;
        const analyses = await Analysis.find({ userId })
            .sort({ createdAt: -1 })
            .select('-configContent')
            .lean();

        res.json(analyses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllUsers,
    createUser,
    updateUserRole,
    deleteUser,
    getAllAnalyses,
    getUserAnalyses,
};
