const axios = require('axios');
const { normalizeDifyOrigin } = require('../utils/difyOrigin');
const { extractInputVariable, resolveWorkflowInputKey } = require('../utils/difyWorkflowInput');

const getDifyEnv = () => {
    const baseOrigin = normalizeDifyOrigin(process.env.DIFY_BASE_URL || '');
    const apiKey = (process.env.DIFY_API_KEY || '').trim();
    const requestMode = (process.env.DIFY_REQUEST_MODE || 'workflow').trim();
    return { baseOrigin, apiKey, requestMode };
};

const healthCheck = async (req, res) => {
    const { baseOrigin, apiKey, requestMode } = getDifyEnv();

    if (!apiKey) {
        return res.status(503).json({
            ok: false,
            error: 'DIFY_API_KEY is not set in .env',
        });
    }
    if (!baseOrigin) {
        return res.status(503).json({
            ok: false,
            error: 'DIFY_BASE_URL is invalid',
        });
    }

    try {
        const paramsRes = await axios.get(`${baseOrigin}/v1/parameters`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 15000,
        });
        const detectedInputKey = extractInputVariable(paramsRes.data);
        const inputKey = await resolveWorkflowInputKey(baseOrigin, apiKey);

        res.json({
            ok: true,
            baseUrl: baseOrigin,
            requestMode,
            detectedInputKey,
            workflowInputKey: inputKey,
            message: 'Dify API is reachable',
        });
    } catch (err) {
        res.status(502).json({
            ok: false,
            baseUrl: baseOrigin,
            requestMode,
            error: err.response?.data?.message || err.message,
            status: err.response?.status,
        });
    }
};

module.exports = { healthCheck };
