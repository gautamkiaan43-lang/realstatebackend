const userService = require('../services/user.service');

class UserController {
    async createManager(req, res) {
        try {
            const user = await userService.createManager(req.body);
            res.status(201).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async createAgent(req, res) {
        try {
            // manager_id comes from req.user.id (attached by protect middleware)
            const managerId = req.user.id;
            const user = await userService.createAgent(req.body, managerId);
            res.status(201).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async getAllUsers(req, res) {
        try {
            const users = await userService.getAllUsers(req.user);
            res.status(200).json({
                status: 'success',
                data: { users }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async updateUser(req, res) {
        try {
            const user = await userService.updateUser(req.params.id, req.body, req.user);
            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async deleteUser(req, res) {
        try {
            await userService.deleteUser(req.params.id);
            res.status(204).json({
                status: 'success',
                data: null
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async updateMe(req, res) {
        try {
            const user = await userService.updateProfile(req.user.id, req.body);
            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async updatePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            await userService.updatePassword(req.user.id, currentPassword, newPassword);
            res.status(200).json({
                status: 'success',
                message: 'Password updated successfully'
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async updateNotifications(req, res) {
        try {
            const user = await userService.updateNotifications(req.user.id, req.body);
            res.status(200).json({
                status: 'success',
                data: { user }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }
}

module.exports = new UserController();
