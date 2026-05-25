const express = require('express');
const commissionController = require('../controllers/commission.controller');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', commissionController.getAllCommissions);
router.post('/', allowRoles('SUPER_ADMIN', 'MANAGER'), commissionController.createCommission);
router.patch('/:id', allowRoles('SUPER_ADMIN', 'MANAGER'), commissionController.updateCommission);

module.exports = router;
