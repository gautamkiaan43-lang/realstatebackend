const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { signToken } = require('../utils/jwt');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ status: 'fail', message: 'Email and password are required' });
            }

            // Find user
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                return res.status(401).json({ status: 'fail', message: 'Invalid email or password' });
            }

            // Check password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ status: 'fail', message: 'Invalid email or password' });
            }

            // Sign token — role comes from DB, never from client
            const token = signToken({ id: user.id, role: user.role });

            res.status(200).json({
                status: 'success',
                token,
                data: {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        language: user.language,
                        notificationSettings: typeof user.notificationSettings === 'string' 
                            ? JSON.parse(user.notificationSettings) 
                            : user.notificationSettings || { email: true, push: true, weekly_report: false, lead_assigned: true }
                    }
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    async getMe(req, res) {
        try {
            // req.user is populated by the protect middleware (JWT verified)
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                    manager_id: true,
                    createdAt: true,
                    notificationSettings: true,
                    language: true
                }
            });
            
            if (!user) {
                return res.status(404).json({ status: 'fail', message: 'User not found' });
            }

            // Parse metadata
            if (user.notificationSettings && typeof user.notificationSettings === 'string') {
                user.notificationSettings = JSON.parse(user.notificationSettings);
            } else if (!user.notificationSettings) {
                user.notificationSettings = { email: true, push: true, weekly_report: false, lead_assigned: true };
            }

            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }
}

module.exports = new AuthController();
