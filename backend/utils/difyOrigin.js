/**
 * Normalize Dify API base: accepts either "http://host:port" or "http://host:port/v1".
 * All callers append paths like "/v1/workflows/run".
 */
function normalizeDifyOrigin(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let u = raw.trim().replace(/\/+$/, '');
    if (u.toLowerCase().endsWith('/v1')) {
        u = u.slice(0, -3);
    }
    return u.replace(/\/+$/, '');
}

module.exports = { normalizeDifyOrigin };
