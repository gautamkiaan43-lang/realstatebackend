const prisma = require('../config/prisma');

class ActivityService {
    async logActivity(data) {
        const { leadId, userId, type, details } = data;
        return await prisma.leadactivity.create({
            data: {
                lead_id: parseInt(leadId),
                user_id: parseInt(userId),
                type,
                details: JSON.stringify(details || {})
            }
        });
    }

    async getLeadActivity(leadId) {
        return await prisma.leadactivity.findMany({
            where: { lead_id: parseInt(leadId) },
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
    }
}

module.exports = new ActivityService();
