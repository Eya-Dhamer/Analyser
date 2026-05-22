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

/**
 * Extract the embedded LLM audit report from Agent 3's archival output.
 * The report is nested inside the add_mem0ai_memory action_input as llm_response.
 */
function extractEmbeddedReport(text) {
    if (typeof text !== 'string') return null;
    const marker = 'llm_response';
    const idx = text.indexOf(marker);
    if (idx === -1) return null;
    const after = text.substring(idx + marker.length);
    const reportStart = after.indexOf('#');
    if (reportStart === -1) return null;
    const reportText = after.substring(reportStart);
    const endMarkers = ['"}', "\\\"}", '\\"assistant\\"'];
    let endIdx = reportText.length;
    for (const em of endMarkers) {
        const pos = reportText.indexOf(em);
        if (pos > 0 && pos < endIdx) endIdx = pos;
    }
    return reportText.substring(0, endIdx)
        .replace(/\\\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}

/**
 * Parse the METADATA_BLOCK summary from Agent 3's output.
 */
function extractMetadataSummary(text) {
    if (typeof text !== 'string') return null;
    const match = text.match(/SUMMARY:\s*(.+?)(?:\n|\\n|\[\/METADATA_BLOCK\]|\[END_METADATA_BLOCK\]|$)/i);
    return match ? match[1].trim() : null;
}

/**
 * Parse structured vulnerabilities from the audit report text.
 * Looks for patterns like [ID_VULN_XX] - Description | Criticité : Level
 */
function parseVulnerabilities(report) {
    if (!report) return [];
    const vulns = [];
    const pattern = /\[ID_VULN_\d+\]\s*[-–]\s*(.+?)\s*\*{0,2}\s*\|\s*Criticit[ée]\s*:\s*(\w+)\s*\n-\s*Ligne coupable\s*:\s*`?([^`\n]+)`?\s*\n-\s*Description\s*:\s*([\s\S]*?)(?=\n\n|\n\*\*\[ID_VULN|$)/gi;
    let m;
    while ((m = pattern.exec(report)) !== null) {
        vulns.push({
            type: m[1].trim(),
            cvss: m[2].toLowerCase() === 'critical' ? 9.0 : m[2].toLowerCase() === 'high' ? 7.0 : m[2].toLowerCase() === 'medium' ? 5.0 : 3.0,
            description: `${m[4].trim()} (Ligne: ${m[3].trim()})`,
            recommendation: '',
        });
    }
    return vulns;
}

/**
 * Parse recommendations from the "Plan d'Action" section.
 */
function parseRecommendations(report) {
    if (!report) return [];
    const recs = [];
    const actionIdx = report.indexOf('Plan d');
    if (actionIdx === -1) return recs;
    const section = report.substring(actionIdx);
    const remedPattern = /Remédiation\s+VULN_\d+[^:]*:\s*(.+?)(?:\s*---|\n)/gi;
    let m;
    while ((m = remedPattern.exec(section)) !== null) {
        recs.push(m[1].trim());
    }
    return recs;
}

/**
 * Extract structured analysis data from Dify agent output text.
 * Handles Agent 3's archival format where the report is embedded.
 */
function extractStructuredAnalysis(outputs) {
    const text = typeof outputs.text === 'string' ? outputs.text : '';
    const report = extractEmbeddedReport(text);
    const metaSummary = extractMetadataSummary(text);

    if (!report && !metaSummary) return null;

    const vulns = parseVulnerabilities(report || text);
    const recs = parseRecommendations(report || text);

    const errors = [];
    if (report) {
        const secMatch = report.match(/Sécurité de l'Administration[\s\S]*?(?=###|$)/i);
        if (secMatch) {
            const issues = secMatch[0].match(/(?:Telnet|en clair|chiffrement faible|proxy[- ]arp)/gi);
            if (issues) {
                errors.push({
                    type: 'Configuration Security',
                    severity: 'high',
                    description: secMatch[0].replace(/^###.*\n/, '').trim().substring(0, 500),
                    solution: recs.length > 0 ? recs.join('; ') : 'Voir le plan d\'action dans le résumé.',
                });
            }
        }
    }

    return {
        summary: metaSummary || (report ? report.substring(0, 500) : text.substring(0, 500)),
        vulnerabilities: vulns,
        errors: errors,
        recommendations: recs,
    };
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

            // Try to extract structured data from agent archival output
            const structured = extractStructuredAnalysis(outputs);

            const rawSummary =
                (structured && structured.summary) ||
                coerceToString(outputs.summary) ||
                coerceToString(outputs.text) ||
                coerceToString(outputs.answer) ||
                'Analyse terminée avec succès.';

            const data = {
                errors: (structured && structured.errors.length > 0)
                    ? structured.errors
                    : coerceToObjectArray(outputs.errors),
                vulnerabilities: (structured && structured.vulnerabilities.length > 0)
                    ? structured.vulnerabilities
                    : coerceToObjectArray(outputs.vulnerabilities),
                recommendations: (structured && structured.recommendations.length > 0)
                    ? structured.recommendations
                    : (Array.isArray(outputs.recommendations)
                        ? outputs.recommendations.map(String)
                        : []),
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
