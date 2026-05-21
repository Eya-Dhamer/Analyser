const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
    userId: {
        type: String,
        ref: 'User',
        required: true,
    },
    configurationId: {
        type: String,
        ref: 'Configuration',
    },
    results: {
        errors: [{
            type: { type: String },
            severity: { type: String },
            description: { type: String },
            solution: { type: String },
        }],
        vulnerabilities: [{
            type: { type: String },
            cvss: { type: Number },
            description: { type: String },
            recommendation: { type: String },
        }],
        recommendations: [String],
        summary: String,
    },
    agentUsed: {
        type: String,
        enum: ['cisco', 'cisco_ios', 'juniper', 'juniper_junos', 'huawei', 'palo_alto', 'firewall', 'generic'],
        default: 'generic',
    },
    processingTime: {
        type: Number,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ configurationId: 1 });

module.exports = mongoose.model('Analysis', analysisSchema);
