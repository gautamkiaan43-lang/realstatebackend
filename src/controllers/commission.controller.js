const prisma = require('../config/prisma');
const commissionService = require('../services/commission.service');

class CommissionController {
    async createCommission(req, res) {
        try {
            const commission = await commissionService.createCommission(req.body);
            res.status(201).json({ status: 'success', data: { commission } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async getAllCommissions(req, res) {
        try {
            const commissions = await commissionService.getAllCommissions(req.user);
            res.status(200).json({ status: 'success', data: { commissions } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }

    async updateCommission(req, res) {
        try {
            const commission = await commissionService.updateCommission(req.params.id, req.body);
            res.status(200).json({ status: 'success', data: { commission } });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message });
        }
    }
}

module.exports = new CommissionController();
