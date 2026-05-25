const propertyService = require('../services/property.service');

class PropertyController {
    async createProperty(req, res) {
        try {
            const property = await propertyService.createProperty(req.body, req.user?.id);
            res.status(201).json({
                status: 'success',
                data: { property }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async getAllProperties(req, res) {
        try {
            const properties = await propertyService.getAllProperties(req.user);
            res.status(200).json({
                status: 'success',
                data: { properties }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async getPropertyById(req, res) {
        try {
            const property = await propertyService.getPropertyById(req.params.id, req.user);
            if (!property) throw new Error('Property not found');
            res.status(200).json({
                status: 'success',
                data: { property }
            });
        } catch (error) {
            const statusCode = error.status || 400;
            res.status(statusCode).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async updateProperty(req, res) {
        try {
            const property = await propertyService.updateProperty(req.params.id, req.body, req.user);
            res.status(200).json({
                status: 'success',
                data: { property }
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    async deleteProperty(req, res) {
        try {
            await propertyService.deleteProperty(req.params.id, req.user);
            res.status(204).json({
                status: 'success',
                data: null
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }
}

module.exports = new PropertyController();
