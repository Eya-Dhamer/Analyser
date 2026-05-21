const mongoose = require('mongoose');
const { DEVICE_TYPES } = require('../utils/configProcessing');

const configurationSchema = new mongoose.Schema({
    userId: {
        type: String,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    filename: {
        type: String,
        trim: true,
    },
    content: {
        type: String,
        required: true,
    },
    deviceType: {
        type: String,
        enum: DEVICE_TYPES,
        default: 'generic',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

configurationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Configuration', configurationSchema);
