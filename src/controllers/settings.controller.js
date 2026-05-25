const prisma = require('../config/prisma');

// Get all website configurations
exports.getWebsiteConfigs = async (req, res) => {
    try {
        const configs = await prisma.websiteConfig.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({
            status: 'success',
            data: { configs }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Create a new website configuration
exports.createWebsiteConfig = async (req, res) => {
    try {
        const { name, domain, apiEndpoint } = req.body;
        const config = await prisma.websiteConfig.create({
            data: {
                name,
                domain,
                apiEndpoint,
                status: 'disconnected'
            }
        });
        res.status(201).json({
            status: 'success',
            data: { config }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update a website configuration
exports.updateWebsiteConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, domain, apiEndpoint, status } = req.body;
        
        const config = await prisma.websiteConfig.update({
            where: { id: parseInt(id) },
            data: {
                name,
                domain,
                apiEndpoint,
                status,
                updatedAt: new Date()
            }
        });
        
        res.status(200).json({
            status: 'success',
            data: { config }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Delete a website configuration
exports.deleteWebsiteConfig = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.websiteConfig.delete({
            where: { id: parseInt(id) }
        });
        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};
