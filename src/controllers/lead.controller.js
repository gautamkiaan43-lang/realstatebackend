const leadService = require('../services/lead.service');
const activityService = require('../services/activity.service');
const conversionService = require('../services/conversion.service');
const matchingService = require('../services/matching.service');

class LeadController {
    async createLead(req, res) {
        try {
            const lead = await leadService.createLead(req.body, req.user);
            res.status(201).json({ status: 'success', data: { lead } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async getAllLeads(req, res) {
        try {
            const leads = await leadService.getAllLeads(req.user);
            res.status(200).json({ status: 'success', data: { leads } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async getLeadById(req, res) {
        try {
            const lead = await leadService.getLeadById(req.params.id, req.user);
            res.status(200).json({ status: 'success', data: { lead } });
        } catch (error) {
            const status = error.status || 404;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }

    async getLeadActivity(req, res) {
        try {
            const activities = await activityService.getLeadActivity(req.params.id);
            res.status(200).json({ status: 'success', data: { activities } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async logActivity(req, res) {
        try {
            const activity = await activityService.logActivity({
                leadId: req.params.id,
                userId: req.user.id,
                ...req.body
            });
            res.status(201).json({ status: 'success', data: { activity } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async reassignLead(req, res) {
        try {
            const { newOwnerId } = req.body;
            if (!newOwnerId) throw new Error('newOwnerId is required for reassignment.');
            
            const lead = await leadService.reassignLead(req.params.id, newOwnerId, req.user);
            res.status(200).json({ status: 'success', data: { lead } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async updateLead(req, res) {
        try {
            const lead = await leadService.updateLead(req.params.id, req.body, req.user);
            res.status(200).json({ status: 'success', data: { lead } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async convertLead(req, res) {
        try {
            const result = await conversionService.convertLead(req.params.id, req.body, req.user);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async suggestProperties(req, res) {
        try {
            const matches = await matchingService.suggestProperties(req.params.id);
            res.status(200).json({ status: 'success', data: { matches } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async deleteLead(req, res) {
        try {
            await leadService.deleteLead(req.params.id, req.user);
            res.status(204).json({ status: 'success', data: null });
        } catch (error) {
            const status = error.status || 400;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }
}

module.exports = new LeadController();
