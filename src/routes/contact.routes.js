const express = require('express');
const contactController = require('../controllers/contact.controller');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', contactController.getAllContacts);
router.get('/:id', contactController.getContactById);
router.post('/', contactController.createContact);
router.patch('/:id', contactController.updateContact);
router.delete('/:id', allowRoles('SUPER_ADMIN', 'MANAGER', 'AGENT'), contactController.deleteContact);

module.exports = router;
