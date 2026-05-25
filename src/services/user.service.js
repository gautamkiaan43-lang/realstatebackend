const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

class UserService {
    async createManager(data) {
        const { name, email, password } = data;

        // Check if user exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) throw new Error('Email already in use');

        const hashedPassword = await bcrypt.hash(password, 10);

        return await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'MANAGER',
                manager_id: null
            }
        });
    }

    async createAgent(data, managerId) {
        const { name, email, password } = data;

        // Check if user exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) throw new Error('Email already in use');

        const hashedPassword = await bcrypt.hash(password, 10);

        return await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'AGENT',
                manager_id: managerId
            }
        });
    }

    async getAllUsers(callerUser) {
        const userId = parseInt(callerUser?.id);
        if (!userId) return [];

        // Fetch full caller metadata to resolve manager_id and current role from DB
        const fullUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!fullUser) return [];

        const { role, id, manager_id } = fullUser;
        
        const scope = {};
        if (role === 'MANAGER') {
            scope.OR = [
                { id: parseInt(id) },
                { manager_id: parseInt(id) }
            ];
        } else if (role === 'AGENT') {
            // Agents see themselves, their manager, and teammates
            const conditions = [{ id: parseInt(id) }];
            if (manager_id) {
                conditions.push({ id: parseInt(manager_id) });
                conditions.push({ manager_id: parseInt(manager_id) });
            }
            scope.OR = conditions;
        }

        const users = await prisma.user.findMany({
            where: scope,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                manager_id: true,
                createdAt: true
            }
        });
        return users.map(u => this._parseUser(u));
    }
    async updateUser(id, data, callerUser) {
        const { name, email, role, password, status, commission_rate } = data;
        const targetUserId = parseInt(id);
        const callerRole = callerUser?.role || 'SUPER_ADMIN';
        const callerId = callerUser?.id;

        // Fetch target user for existence/scope check
        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) throw new Error('User not found');

        // RBAC Enforcement
        if (callerRole === 'MANAGER') {
            // Managers can only update themselves or their own agents
            if (targetUser.id !== callerId && targetUser.manager_id !== callerId) {
                throw new Error('Unauthorized: You can only manage members of your own team');
            }
            // Managers cannot change roles of anyone (including themselves) via this endpoint
            if (role && role !== targetUser.role) {
                throw new Error('Unauthorized: Managers cannot modify user roles');
            }
        } else if (callerRole === 'AGENT') {
            // Agents can only update themselves
            if (targetUser.id !== callerId) {
                throw new Error('Unauthorized: Agents can only update their own profile');
            }
            if (role && role !== 'AGENT') {
                throw new Error('Unauthorized: Agents cannot change their own role');
            }
        }

        const updateData = { name, email, role, status };
        
        if (commission_rate !== undefined) {
            updateData.commission_rate = parseFloat(commission_rate);
        }

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updated = await prisma.user.update({
            where: { id: targetUserId },
            data: updateData
        });
        return this._parseUser(updated);
    }

    async deleteUser(id) {
        return await prisma.user.delete({
            where: { id: parseInt(id) }
        });
    }

    async updateProfile(userId, data) {
        const { name, email, language } = data;
        return await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { name, email, language }
        }).then(this._parseUser);
    }

    async updatePassword(userId, currentPassword, newPassword) {
        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user) throw new Error('User not found');

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) throw new Error('Incorrect current password');

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        return await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { password: hashedPassword }
        });
    }

    async updateNotifications(userId, settings) {
        return await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { notificationSettings: JSON.stringify(settings) }
        }).then(this._parseUser);
    }

    _parseUser(user) {
        if (!user) return null;
        try {
            return {
                ...user,
                notificationSettings: typeof user.notificationSettings === 'string'
                    ? JSON.parse(user.notificationSettings)
                    : user.notificationSettings || { email: true, push: true, weekly_report: false, lead_assigned: true }
            };
        } catch (e) {
            return { ...user, notificationSettings: { email: true, push: true, weekly_report: false, lead_assigned: true } };
        }
    }
}

module.exports = new UserService();
