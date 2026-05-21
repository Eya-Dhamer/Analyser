/**
 * Normalize submitted network configuration text for storage (not sent to AI unless identical to raw).
 */
function cleanConfigContent(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.replace(/^\uFEFF/, '');
    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    s = s.trim();
    s = s.replace(/\n{3,}/g, '\n\n');
    return s;
}

const DEVICE_TYPES = ['cisco_ios', 'juniper_junos', 'huawei', 'palo_alto', 'generic'];

/**
 * Best-effort device family from filename and config heuristics.
 */
function inferDeviceType(fileName, rawContent) {
    const name = (fileName || '').toLowerCase();
    const body = (rawContent || '').slice(0, 8000).toLowerCase();

    if (/junos|juniper|set interfaces|set system host-name/.test(name) || /set system host-name|set interfaces/.test(body)) {
        return 'juniper_junos';
    }
    if (/huawei|vrp|acl ipv6/.test(name) || /\binterface gigabitethernet\b.*\bundo shutdown\b/.test(body)) {
        return 'huawei';
    }
    if (/palo|pan-os|set deviceconfig/.test(name) || /set deviceconfig system/.test(body)) {
        return 'palo_alto';
    }
    if (/\.cfg$|cisco|ios-xe|asa/.test(name) || /\bhostname\b|\binterface (gigabit|fast)ethernet\b|\bip access-list extended\b/.test(body)) {
        return 'cisco_ios';
    }
    return 'generic';
}

module.exports = { cleanConfigContent, inferDeviceType, DEVICE_TYPES };
