const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Public: Login
router.post('/login', authController.login);

// Protected: Get current logged-in user (session restore)
router.get('/me', protect, authController.getMe);

module.exports = router;
