const express = require('express');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const settingsController = require('../controllers/settings.controller');

const router = express.Router();

router.use(protect);

// Website Configuration routes (Restricted to SUPER_ADMIN and MANAGER)
router.use(restrictTo('SUPER_ADMIN', 'MANAGER'));

router.get('/websites', settingsController.getWebsiteConfigs);
router.post('/websites', settingsController.createWebsiteConfig);
router.patch('/websites/:id', settingsController.updateWebsiteConfig);
router.delete('/websites/:id', settingsController.deleteWebsiteConfig);

module.exports = router;
