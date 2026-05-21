const axios = require('axios');

/**
 * Read the workflow start-node variable name from Dify GET /v1/parameters.
 */
function extractInputVariable(parametersBody) {
    const form = parametersBody?.user_input_form;
    if (!Array.isArray(form)) return null;

    for (const entry of form) {
        const config =
            entry.paragraph ||
            entry['text-input'] ||
            entry.text_input ||
            entry.textarea ||
            entry.select ||
            entry.number;
        if (config?.variable) return config.variable;
    }
    return null;
}

/**
 * Resolve workflow input key: env override, then Dify /parameters, then fallback.
 */
async function resolveWorkflowInputKey(baseOrigin, apiKey) {
    const fromEnv = (process.env.DIFY_WORKFLOW_INPUT_KEY || '').trim();
    if (fromEnv) return fromEnv;

    const res = await axios.get(`${baseOrigin}/v1/parameters`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: Number(process.env.DIFY_TIMEOUT_MS || 30000),
    });
    return extractInputVariable(res.data) || 'query';
}

module.exports = {
    extractInputVariable,
    resolveWorkflowInputKey,
};
