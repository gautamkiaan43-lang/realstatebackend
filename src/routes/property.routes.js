const express = require('express');
const propertyController = require('../controllers/property.controller');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const router = express.Router();

// Apply auth protection to all routes
router.use(protect);

// Routes
router.get('/', propertyController.getAllProperties);
router.get('/:id', propertyController.getPropertyById);
router.post('/', allowRoles('SUPER_ADMIN', 'MANAGER'), propertyController.createProperty);
router.patch('/:id', allowRoles('SUPER_ADMIN', 'MANAGER'), propertyController.updateProperty);

// Only Superadmin and Manager can delete properties
router.delete('/:id', allowRoles('SUPER_ADMIN', 'MANAGER'), propertyController.deleteProperty);

module.exports = router;
