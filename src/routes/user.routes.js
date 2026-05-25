const express = require('express');
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const router = express.Router();

// Only superadmin, manager, and agent (scoped) can list users
router.get('/', protect, allowRoles('SUPER_ADMIN', 'MANAGER', 'AGENT'), userController.getAllUsers);

// Only superadmin can create manager
router.post('/manager', protect, allowRoles('SUPER_ADMIN'), userController.createManager);

// Only manager can create agent
router.post('/agent', protect, allowRoles('MANAGER'), userController.createAgent);

// User profile and preferences
router.patch('/profile', protect, userController.updateMe);
router.patch('/security', protect, userController.updatePassword);
router.patch('/notifications', protect, userController.updateNotifications);

// Admin / Manager can update/delete users (RBAC check inside controller or middleware recommended, here simplified to role check)
router.patch('/:id', protect, allowRoles('SUPER_ADMIN', 'MANAGER'), userController.updateUser);
router.delete('/:id', protect, allowRoles('SUPER_ADMIN', 'MANAGER'), userController.deleteUser);

module.exports = router;
