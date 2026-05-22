// services/ai.js
const axios = require('axios');
const { normalizeDifyOrigin } = require('../utils/difyOrigin');
const { resolveWorkflowInputKey } = require('../utils/difyWorkflowInput');

function pickSecurityScore(outputs) {
    const raw = outputs.security_score ?? outputs.securityScore ?? outputs.score;
    if (raw === undefined || raw === null || raw === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

function pickLlmModel(outputs, responseData) {
    const fromOutputs = outputs.llm_model ?? outputs.llmModel;
    if (fromOutputs != null && fromOutputs !== '') return String(fromOutputs);
    if (responseData?.model != null && responseData.model !== '') return String(responseData.model);
    return undefined;
}

/**
 * Merge structured JSON sometimes returned as a string in workflow `outputs.text`.
 */
function mergeOutputsFromWorkflow(outputs) {
    if (!outputs || typeof outputs !== 'object') return {};
    let merged = { ...outputs };
    const text = merged.text;
    if (typeof text !== 'string' || text.trim() === '') return merged;
    const trimmed = text.trim();
    if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) return merged;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            merged = { ...parsed, ...merged };
        }
    } catch (_) {
        /* keep raw outputs */
    }
    return merged;
}

function coerceToString(val) {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function coerceToObjectArray(val) {
    if (!Array.isArray(val)) return [];
    return val.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

class AIService {
    constructor() {
        this.groqApiKey = process.env.GROQ_API_KEY;
    }

    /**
     * Main analysis function — Dify Chat API or Workflow API (per settings / env).
     * @param {string} configContent
     * @param {{ userId?: string }} [options]
     */
    async analyzeNetworkConfig(configContent, options = {}) {
        const startTime = Date.now();
        let baseOrigin = '';
        let requestMode = 'chat';
        const user =
            (options.userId && String(options.userId)) ||
            process.env.DIFY_END_USER_ID ||
            'netanalyzer-user';

        try {
            if (!configContent || configContent.trim() === '') {
                throw new Error('Configuration content is required');
            }

            /** Use environment variables only */
            const rawBase =
                (process.env.DIFY_BASE_URL && process.env.DIFY_BASE_URL.trim()) ||
                'http://localhost:8000';
            baseOrigin = normalizeDifyOrigin(rawBase);
            const apiKey =
                (process.env.DIFY_API_KEY && process.env.DIFY_API_KEY.trim());
            requestMode =
                (process.env.DIFY_REQUEST_MODE && process.env.DIFY_REQUEST_MODE.trim()) ||
                'workflow';
            const workflowId = (
                process.env.DIFY_WORKFLOW_ID ||
                ''
            ).trim();
            const inputKey =
                requestMode === 'workflow'
                    ? await resolveWorkflowInputKey(baseOrigin, apiKey)
                    : 'query';
            const timeoutMs = Number(process.env.DIFY_TIMEOUT_MS || 300000);

            if (!apiKey) {
                throw new Error('Dify API Key is missing. Please configure DIFY_API_KEY in .env file.');
            }
            if (!baseOrigin) {
                throw new Error('Dify base URL is invalid.');
            }

            let response;
            if (requestMode === 'workflow') {
                const path = workflowId
                    ? `/v1/workflows/${workflowId}/run`
                    : '/v1/workflows/run';
                const url = `${baseOrigin}${path}`;
                console.log(
                    `[AI Service] Calling Dify Workflow API: POST ${url} (input key: ${inputKey})`,
                );

                const body = {
                    inputs: {
                        [inputKey]: configContent,
                    },
                    response_mode: 'blocking',
                    user,
                };

                response = await axios.post(url, body, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: timeoutMs,
                });
                console.log(`[AI Service] Workflow response received from ${baseOrigin}`);
            } else {
                console.log(`[AI Service] Calling Dify Chat API at ${baseOrigin}/v1/chat-messages...`);
                response = await axios.post(
                    `${baseOrigin}/v1/chat-messages`,
                    {
                        inputs: {},
                        query: `Analyze this network configuration:\n\n${configContent}`,
                        response_mode: 'blocking',
                        user,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: timeoutMs,
                    },
                );
                console.log(`[AI Service] Chat response received from ${baseOrigin}`);
            }

            const payload = response.data;
            let outputs = {};

            if (requestMode === 'workflow') {
                const resultData = payload.data || payload;
                if (resultData.status === 'failed' || resultData.status === 'stopped') {
                    throw new Error(resultData.error || 'Dify workflow execution failed');
                }
                const inner = resultData.data || resultData;
                if (inner.status === 'failed' || inner.status === 'stopped') {
                    throw new Error(inner.error || 'Dify workflow execution failed');
                }
                const rawOutputs =
                    inner.outputs !== undefined ? inner.outputs : resultData.outputs;
                outputs =
                    typeof rawOutputs === 'object' && rawOutputs !== null
                        ? mergeOutputsFromWorkflow(rawOutputs)
                        : {};
            } else {
                const msg = payload.data || payload;
                let raw = msg.outputs;
                if (raw === undefined && typeof msg === 'object' && msg !== null) {
                    raw = msg;
                }
                outputs =
                    typeof raw === 'object' && raw !== null
                        ? mergeOutputsFromWorkflow(raw)
                        : {};
                if (msg.answer) {
                    outputs = mergeOutputsFromWorkflow({
                        ...outputs,
                        text: outputs.text || msg.answer,
                    });
                }
            }

            const securityScore = pickSecurityScore(outputs);
            const llmModel = pickLlmModel(outputs, payload);

            const rawSummary =
                coerceToString(outputs.summary) ||
                coerceToString(outputs.text) ||
                coerceToString(outputs.answer) ||
                'Analyse terminée avec succès.';

            const data = {
                errors: coerceToObjectArray(outputs.errors),
                vulnerabilities: coerceToObjectArray(outputs.vulnerabilities),
                recommendations: Array.isArray(outputs.recommendations)
                    ? outputs.recommendations.map(String)
                    : [],
                summary: rawSummary,
            };
            if (securityScore !== undefined) data.securityScore = securityScore;
            if (llmModel !== undefined) data.llmModel = llmModel;

            return {
                success: true,
                data,
                analysisTime: Date.now() - startTime,
            };
        } catch (error) {
            const wfPath =
                requestMode === 'workflow'
                    ? '/v1/workflows/run or /v1/workflows/:id/run'
                    : '/v1/chat-messages';
            console.error('Dify Integration Error:', {
                url: `${baseOrigin}${wfPath}`,
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });

            const remote = error.response?.data;
            const remoteMsg =
                (typeof remote === 'string' && remote) ||
                remote?.message ||
                remote?.error ||
                (remote?.data && JSON.stringify(remote.data)) ||
                '';

            return {
                success: false,
                analysisTime: Date.now() - startTime,
                error: remoteMsg || error.message || 'AI analysis failed',
                data: {
                    errors: [
                        {
                            type: 'Dify Error',
                            severity: 'high',
                            description:
                                remoteMsg ||
                                `Failed to reach Dify (${error.response?.status || 'no response'}): ${error.message}`,
                        },
                    ],
                    vulnerabilities: [],
                    recommendations: [],
                    summary:
                        remoteMsg ||
                        "L'analyse a échoué. Vérifiez l'URL Dify (port), la clé API, et le nom de variable d'entrée du workflow (DIFY_WORKFLOW_INPUT_KEY).",
                },
            };
        }
    }
}

module.exports = new AIService();
