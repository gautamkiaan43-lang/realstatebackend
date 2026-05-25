const prisma = require('../config/prisma');

class NotificationService {
    async createNotification(userId, type, message) {
        return await prisma.notification.create({
            data: {
                user_id: parseInt(userId),
                type,
                message
            }
        });
    }

    async getNotifications(userId) {
        return await prisma.notification.findMany({
            where: { user_id: parseInt(userId) },
            orderBy: { createdAt: 'desc' }
        });
    }

    async markAsRead(id) {
        return await prisma.notification.update({
            where: { id: parseInt(id) },
            data: { is_read: true }
        });
    }
}

module.exports = new NotificationService();
