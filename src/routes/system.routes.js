const express = require('express');
const { getSystemStatus } = require('../controllers/system.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

// Allow access for all authenticated roles to verify system health
router.get('/status', restrictTo('SUPER_ADMIN', 'MANAGER', 'AGENT'), getSystemStatus);

module.exports = router;
