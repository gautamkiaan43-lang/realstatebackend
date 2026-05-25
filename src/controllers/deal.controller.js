const dealService = require('../services/deal.service');

class DealController {
    async createDeal(req, res) {
        try {
            const deal = await dealService.createDeal(req.body, req.user);
            res.status(201).json({ status: 'success', data: { deal } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async getAllDeals(req, res) {
        try {
            const deals = await dealService.getAllDeals(req.user);
            res.status(200).json({ status: 'success', data: { deals } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async getDealById(req, res) {
        try {
            const deal = await dealService.getDealById(req.params.id, req.user);
            if (!deal) {
                return res.status(404).json({ status: 'fail', message: 'Deal not found' });
            }
            res.status(200).json({ status: 'success', data: { deal } });
        } catch (error) {
            const status = error.status || 400;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }

    async updateDeal(req, res) {
        try {
            const deal = await dealService.updateDeal(req.params.id, req.body, req.user);
            res.status(200).json({ status: 'success', data: { deal } });
        } catch (error) {
            const status = error.status || 400;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }

    async deleteDeal(req, res) {
        try {
            await dealService.deleteDeal(req.params.id, req.user);
            res.status(204).json({ status: 'success', data: null });
        } catch (error) {
            const status = error.status || 400;
            res.status(status).json({ status: 'fail', message: error.message });
        }
    }

    async addNote(req, res) {
        try {
            const deal = await dealService.addNote(req.params.id, req.body.noteText, req.user.id);
            res.status(200).json({ status: 'success', data: { deal } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }
}

module.exports = new DealController();
