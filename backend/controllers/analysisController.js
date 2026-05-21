const Analysis = require('../models/Analysis');
const User = require('../models/User');
const Configuration = require('../models/Configuration');
const aiService = require('../services/ai');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { cleanConfigContent, inferDeviceType } = require('../utils/configProcessing');

async function applyAiResultToAnalysis(analysis, result, deviceType) {
    analysis.status = result.success ? 'completed' : 'failed';
    analysis.agentUsed = deviceType || 'generic';
    analysis.processingTime = result.analysisTime;
    
    if (result.success) {
        analysis.results = {
            errors: result.data.errors || [],
            vulnerabilities: result.data.vulnerabilities || [],
            recommendations: result.data.recommendations || [],
            summary: result.data.summary || '',
        };
    } else if (result.data) {
        analysis.results = {
            errors: result.data.errors || [],
            vulnerabilities: [],
            recommendations: [],
            summary: result.data.summary || result.error || 'Analysis failed — see error details below.',
        };
    }
    await analysis.save();
}

const guestAnalysis = async (req, res) => {
    try {
        const { configContent } = req.body;
        if (!configContent) {
            return res.status(400).json({ error: 'Configuration content is required' });
        }

        const result = await aiService.analyzeNetworkConfig(configContent, { userId: 'guest' });

        if (!result.success) {
            return res.status(502).json({
                error: result.error || 'AI analysis failed',
                status: 'failed',
                errors: result.data?.errors || [],
                vulnerabilities: result.data?.vulnerabilities || [],
                recommendations: result.data?.recommendations || [],
                summary: result.data?.summary || '',
                analysisTime: result.analysisTime,
            });
        }

        res.json({
            status: 'completed',
            errors: result.data.errors || [],
            vulnerabilities: result.data.vulnerabilities || [],
            recommendations: result.data.recommendations || [],
            summary: result.data.summary || '',
            analysisTime: result.analysisTime,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const submitAnalysis = async (req, res) => {
    try {
        const { configName, configContent } = req.body;
        if (!configContent) {
            return res.status(400).json({ error: 'Configuration content is required' });
        }

        const name = configName || 'Unnamed Configuration';
        const deviceType = inferDeviceType(name, configContent);
        const configuration = new Configuration({
            userId: req.user._id,
            name,
            filename: name,
            content: configContent,
            deviceType,
        });
        await configuration.save();

        const analysis = new Analysis({
            userId: req.user._id,
            configurationId: configuration._id,
            status: 'pending',
        });
        await analysis.save();

        res.status(202).json({ analysisId: analysis._id, status: 'pending' });

        try {
            const result = await aiService.analyzeNetworkConfig(configContent, {
                userId: req.user._id.toString(),
            });
            await applyAiResultToAnalysis(analysis, result, deviceType);
        } catch (aiErr) {
            analysis.status = 'failed';
            await analysis.save();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const getSharedAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findOne({
            shareToken: req.params.token,
        });

        if (!analysis) {
            return res.status(404).json({ error: 'Shared analysis not found' });
        }

        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const getUserAnalyses = async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = { userId: req.user._id };

        if (search) {
            const configIds = await Configuration.find({
                userId: req.user._id,
                name: { $regex: search, $options: 'i' },
            }).distinct('_id');
            query.configurationId = { $in: configIds };
        }

        if (status && ['pending', 'completed', 'failed'].includes(status)) {
            query.status = status;
        }

        const analyses = await Analysis.find(query)
            .populate('configurationId', 'name deviceType')
            .sort({ createdAt: -1 });

        res.json(analyses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const getAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findById(req.params.id);
        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        if (
            analysis.userId.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin'
        ) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

function sanitizeFilename(name) {
    return String(name || 'analysis')
        .replace(/[^\w.\-]+/g, '_')
        .slice(0, 80);
}

const exportAnalysis = async (req, res) => {
    try {
        const format = String(req.query.format || 'json').toLowerCase();
        if (!['json', 'pdf'].includes(format)) {
            return res.status(400).json({ error: 'format must be json or pdf' });
        }

        const analysis = await Analysis.findById(req.params.id).populate('configurationId');
        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        if (
            analysis.userId.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin'
        ) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const configName = analysis.configurationId?.name || analysis._id.toString();
        const baseName = sanitizeFilename(configName);
        const stamp = new Date(analysis.createdAt || Date.now()).toISOString().slice(0, 10);

        if (format === 'json') {
            const payload = analysis.toObject();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${baseName}-analysis-${stamp}.json"`
            );
            return res.send(JSON.stringify(payload, null, 2));
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${baseName}-analysis-${stamp}.pdf"`
        );

        const doc = new PDFDocument({ margin: 48, size: 'A4' });
        doc.pipe(res);

        doc.fontSize(18).text('Network configuration analysis', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#444');
        doc.text(`Configuration: ${configName}`);
        doc.text(`Status: ${analysis.status}`);
        doc.text(`Date: ${(analysis.createdAt || new Date()).toISOString()}`);
        if (analysis.agentUsed) {
            doc.text(`Agent: ${analysis.agentUsed}`);
        }
        if (analysis.processingTime) {
            doc.text(`Processing time: ${analysis.processingTime}ms`);
        }
        doc.moveDown();
        doc.fillColor('#000');

        if (analysis.results?.summary) {
            doc.fontSize(12).text('Summary', { underline: true });
            doc.fontSize(10).text(analysis.results.summary, { align: 'left' });
            doc.moveDown();
        }

        const writeList = (title, items, lineFn) => {
            if (!items || !items.length) return;
            doc.addPage();
            doc.fontSize(12).text(title, { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(9);
            items.forEach((item, i) => {
                doc.text(`${i + 1}. ${lineFn(item)}`, { paragraphGap: 4 });
            });
        };

        writeList('Errors / misconfigurations', analysis.results?.errors, (e) => {
            const sev = e.severity ? `[${e.severity}] ` : '';
            const desc = e.description || e.type || '';
            const sol = e.solution ? ` — ${e.solution}` : '';
            return `${sev}${desc}${sol}`;
        });

        writeList('Vulnerabilities', analysis.results?.vulnerabilities, (v) => {
            const cvss = v.cvss != null ? `CVSS ${v.cvss} — ` : '';
            return `${cvss}${v.description || v.type || ''}`;
        });

        if (analysis.results?.recommendations && analysis.results.recommendations.length) {
            doc.addPage();
            doc.fontSize(12).text('Recommendations', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(9);
            analysis.results.recommendations.forEach((r, i) => {
                doc.text(`${i + 1}. ${r}`, { paragraphGap: 3 });
            });
        }

        if (analysis.configurationId?.content) {
            doc.addPage();
            doc.fontSize(11).text('Original configuration (excerpt)', { underline: true });
            doc.moveDown(0.3);
            const excerpt = analysis.configurationId.content.length > 12000
                ? `${analysis.configurationId.content.slice(0, 12000)}\n\n[... truncated ...]`
                : analysis.configurationId.content;
            doc.fontSize(7).text(excerpt, { align: 'left' });
        }

        doc.end();
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
};

const shareAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findById(req.params.id);
        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        if (analysis.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!analysis.shareToken) {
            analysis.shareToken = crypto.randomBytes(16).toString('hex');
        }
        await analysis.save();

        res.json({
            shareToken: analysis.shareToken,
            shareUrl: `/shared/${analysis.shareToken}`,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const deleteAnalysis = async (req, res) => {
    try {
        const analysis = await Analysis.findById(req.params.id);
        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }

        if (
            analysis.userId.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin'
        ) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (analysis.configurationId) {
            await Configuration.findByIdAndDelete(analysis.configurationId);
        }
        await analysis.deleteOne();
        res.json({ message: 'Analysis deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const guestAnalysisFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File is required' });
        }

        const configContent = req.file.buffer.toString('utf8');

        const result = await aiService.analyzeNetworkConfig(configContent, { userId: 'guest' });

        if (!result.success) {
            return res.status(502).json({
                error: result.error || 'AI analysis failed',
                status: 'failed',
                fileName: req.file.originalname,
                errors: result.data?.errors || [],
                vulnerabilities: result.data?.vulnerabilities || [],
                recommendations: result.data?.recommendations || [],
                summary: result.data?.summary || '',
                analysisTime: result.analysisTime,
            });
        }

        res.json({
            status: 'completed',
            fileName: req.file.originalname,
            errors: result.data.errors || [],
            vulnerabilities: result.data.vulnerabilities || [],
            recommendations: result.data.recommendations || [],
            summary: result.data.summary || '',
            analysisTime: result.analysisTime,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


const submitAnalysisFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File is required' });
        }

        const configContent = req.file.buffer.toString('utf8');
        const configName = req.body.configName || req.file.originalname;
        const deviceType = inferDeviceType(configName, configContent);

        const configuration = new Configuration({
            userId: req.user._id,
            name: configName,
            filename: req.file.originalname,
            content: configContent,
            deviceType,
        });
        await configuration.save();

        const analysis = new Analysis({
            userId: req.user._id,
            configurationId: configuration._id,
            status: 'pending',
        });
        await analysis.save();

        res.status(202).json({ analysisId: analysis._id, status: 'pending' });

        try {
            const result = await aiService.analyzeNetworkConfig(configContent, {
                userId: req.user._id.toString(),
            });
            await applyAiResultToAnalysis(analysis, result, deviceType);
        } catch (aiErr) {
            analysis.status = 'failed';
            await analysis.save();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    guestAnalysis,
    guestAnalysisFile,
    submitAnalysis,
    submitAnalysisFile,
    getSharedAnalysis,
    getUserAnalyses,
    getAnalysis,
    exportAnalysis,
    shareAnalysis,
    deleteAnalysis,
};
