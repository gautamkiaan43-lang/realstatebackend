const reportService = require('../services/report.service');

class ReportController {
    async getReportDashboard(req, res) {
        try {
            const kpis = await reportService.getKPIs(req.user);
            const monthlyRevenue = await reportService.getMonthlyRevenue(req.user);
            const teamPerformance = await reportService.getTeamPerformance(req.user);

            res.status(200).json({
                status: 'success',
                data: {
                    kpis,
                    monthlyRevenue,
                    teamPerformance
                }
            });
        } catch (error) {
            res.status(400).json({ status: 'fail', message: error.message || 'Simulation of reports failed' });
        }
    }
}

module.exports = new ReportController();
