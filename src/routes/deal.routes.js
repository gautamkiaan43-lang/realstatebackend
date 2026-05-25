const express = require('express');
const dealController = require('../controllers/deal.controller');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', dealController.getAllDeals);
router.get('/:id', allowRoles('SUPER_ADMIN', 'MANAGER', 'AGENT'), dealController.getDealById);
router.post('/', allowRoles('SUPER_ADMIN', 'MANAGER', 'AGENT'), dealController.createDeal);
router.patch('/:id', allowRoles('SUPER_ADMIN', 'MANAGER', 'AGENT'), dealController.updateDeal);
router.post('/:id/notes', allowRoles('SUPER_ADMIN', 'MANAGER', 'AGENT'), dealController.addNote);
router.delete('/:id', allowRoles('SUPER_ADMIN', 'MANAGER', 'AGENT'), dealController.deleteDeal);

module.exports = router;
