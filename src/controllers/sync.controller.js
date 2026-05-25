const syncService = require('../services/sync.service');

class SyncController {
    /**
     * POST /api/sync/publish/:propertyId/:siteKey
     */
    async publishToSite(req, res) {
        try {
            const { propertyId, siteKey } = req.params;
            const result = await syncService.publishToSite(propertyId, siteKey, req.user.id);
            res.status(200).json({
                status: 'success',
                ...result
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }

    /**
     * GET /api/sync/stats
     */
    async getStats(req, res) {
        try {
            const stats = await syncService.getStats();
            res.status(200).json({
                status: 'success',
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * GET /api/sync/activity
     */
    async getActivityLogs(req, res) {
        try {
            const logs = await syncService.getActivityLogs();
            res.status(200).json({
                status: 'success',
                data: { logs }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * GET /api/sync/errors
     */
    async getSyncErrors(req, res) {
        try {
            const errors = await syncService.getSyncErrors();
            res.status(200).json({
                status: 'success',
                data: { errors }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * POST /api/sync/force-resync
     */
    async forceResync(req, res) {
        try {
            const result = await syncService.forceResync(req.user.id);
            res.status(200).json({
                status: 'success',
                ...result
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    }

    /**
     * POST /api/sync/retry/:errorId
     */
    async retryError(req, res) {
        try {
            const result = await syncService.retryError(req.params.errorId);
            res.status(200).json({
                status: 'success',
                ...result
            });
        } catch (error) {
            res.status(400).json({
                status: 'fail',
                message: error.message
            });
        }
    }
}

module.exports = new SyncController();
