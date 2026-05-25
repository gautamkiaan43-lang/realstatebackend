const prisma = require('../config/prisma');

class AuditService {
    /**
     * Immutable log for enterprise tracking and legal accountability.
     */
    async log({ userId, action, entityType, entityId, oldValue = null, newValue = null, tx = null }) {
        if (!userId) {
            console.warn('[AUDIT WARNING] Attempted to log without userId. Skipped.', { action, entityType });
            return;
        }

        const data = {
            user_id: parseInt(userId),
            action: action.toUpperCase(),
            entityType,
            entityId: parseInt(entityId) || 0,
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null,
        };

        try {
            if (tx) {
                await tx.auditlog.create({ data });
            } else {
                await prisma.auditlog.create({ data });
            }
        } catch (error) {
            console.error('[AUDIT FATAL ERROR] Failed to record audit log!', data, error);
            // We intentionally swallow the error so normal operations don't completely crash the whole process,
            // but in a strict enterprise compliance environment, throwing here would enforce strict logging.
        }
    }
}

module.exports = new AuditService();
