const User = require('../models/User');
const Session = require('../models/Sessions');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../config/jwt');
const { hashToken } = require('../utils/tokenUtils');

const storeRefreshToken = async (userId, token) => {
    await Session.deleteMany({ userId });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const hashedToken = hashToken(token);
    const session = new Session({
        userId,
        refreshToken: hashedToken,
        expiresAt,
    });
    await session.save();
    return session;
};

const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const adminCount = await User.countDocuments({ role: 'admin' });
        const role = adminCount === 0 ? 'admin' : 'user';

        const user = new User({
            name,
            email: email.toLowerCase(),
            password,
            role,
        });
        await user.save();

        const accessToken = generateAccessToken(user._id, user.role);
        const refreshTokenStr = generateRefreshToken(user._id);
        await storeRefreshToken(user._id, refreshTokenStr);

        res.cookie('refreshToken', refreshTokenStr, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({ accessToken, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'User does not exist. Please sign up first.' });
        }

        const match = await user.comparePassword(password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = generateAccessToken(user._id, user.role);
        const refreshTokenStr = generateRefreshToken(user._id);
        await storeRefreshToken(user._id, refreshTokenStr);

        res.cookie('refreshToken', refreshTokenStr, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ accessToken, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getMe = async (req, res) => {
    res.json({ user: req.user });
};

const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }

        let decoded;
        try {
            decoded = verifyToken(refreshToken);
        } catch {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid token type' });
        }

        const hashedToken = hashToken(refreshToken);
        const session = await Session.findOne({ refreshToken: hashedToken });
        if (!session || session.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Refresh token expired or invalid' });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const newAccessToken = generateAccessToken(user._id, user.role);
        res.json({ accessToken: newAccessToken });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            const hashedToken = hashToken(refreshToken);
            await Session.deleteOne({ refreshToken: hashedToken });
        }

        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    register,
    login,
    getMe,
    refresh,
    logout,
};
