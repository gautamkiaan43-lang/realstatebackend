/**
 * Validates if a lead can transition from one status to another based on role.
 */
const validateStatusTransition = (currentStatus, newStatus, userRole) => {
    if (currentStatus === newStatus) return true;

    // Normalize input to uppercase
    const current = (currentStatus || '').toUpperCase();
    const target = (newStatus || '').toUpperCase();
    const role = (userRole || '').toUpperCase();

    // CRM Workflow: NEW → CONTACTED → QUALIFIED → CONVERSION_REQUESTED → CONVERTED
    const leadTransitions = {
        'NEW': ['CONTACTED', 'LOST'],
        'CONTACTED': ['QUALIFIED', 'REQUESTED_LOST', 'LOST'],
        'QUALIFIED': ['CONVERSION_REQUESTED', 'REQUESTED_LOST', 'LOST'],
        'CONVERSION_REQUESTED': ['CONVERTED', 'QUALIFIED'], // Manager can approve or reject (back to qualified)
        'REQUESTED_LOST': ['LOST', 'QUALIFIED'], // Manager can confirm or reject
        'CONVERTED': [],
        'LOST': ['NEW']
    };

    // Role-based restrictions (Gatekeeper Model)
    if (role === 'AGENT') {
        // Agent cannot finalize CONVERTED or LOST
        if (target === 'CONVERTED' || target === 'LOST') return false;

        // Agent must follow sequence: cannot skip to QUALIFIED from NEW (must go NEW -> CONTACTED -> QUALIFIED)
        if (target === 'QUALIFIED' && current !== 'CONTACTED') return false;

        // Agent can only REQUEST conversion or archival (Initiate phase)
        if (target === 'CONVERSION_REQUESTED' && current !== 'QUALIFIED') return false;
        if (target === 'REQUESTED_LOST' && !['NEW', 'CONTACTED', 'QUALIFIED'].includes(current)) return false;

        return leadTransitions[current]?.includes(target) || false;
    }

    if (role === 'MANAGER' || role === 'SUPER_ADMIN') {
        // Managers/Admins can perform any valid transition defined in the map
        return leadTransitions[current]?.includes(target) || false;
    }

    return false;
};

module.exports = {
    validateStatusTransition
};
