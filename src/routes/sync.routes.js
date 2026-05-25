const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const syncController = require('../controllers/sync.controller');
const router = express.Router();

router.use(protect);

// Publishing & Sync Control
router.post('/publish/:propertyId/:siteKey', syncController.publishToSite);
router.post('/force-resync', syncController.forceResync);
router.post('/retry/:errorId', syncController.retryError);

// Diagnostics & Dashboard Data
router.get('/stats', syncController.getStats);
router.get('/activity', syncController.getActivityLogs);
router.get('/errors', syncController.getSyncErrors);

module.exports = router;
