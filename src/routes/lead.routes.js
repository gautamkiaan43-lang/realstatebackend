const express = require('express');
const leadController = require('../controllers/lead.controller');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', leadController.getAllLeads);
router.post('/', leadController.createLead);
router.get('/:id', leadController.getLeadById);
router.get('/:id/activity', leadController.getLeadActivity);
router.post('/:id/activity', leadController.logActivity);
router.get('/:id/matches', leadController.suggestProperties);
router.post('/:id/convert', allowRoles('SUPER_ADMIN', 'MANAGER'), leadController.convertLead);
router.patch('/:id', leadController.updateLead);
router.patch('/:id/reassign', leadController.reassignLead);
router.delete('/:id', allowRoles('SUPER_ADMIN', 'MANAGER'), leadController.deleteLead);

module.exports = router;
