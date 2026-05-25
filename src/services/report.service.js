const prisma = require('../config/prisma');

class ReportService {
    /**
     * Internal helper to determine correct Prisma scope based on model and role.
     */
    _getScope(user, model) {
        const { id, role } = user;
        if (role === 'SUPER_ADMIN') return {};

        if (model === 'lead') {
            if (role === 'AGENT') return { owner_id: id };
            if (role === 'MANAGER') {
                return {
                    OR: [
                        { manager_id: id },
                        { owner: { manager_id: id } }
                    ]
                };
            }
        }

        if (model === 'deal') {
            if (role === 'AGENT') return { assigned_to: id };
            if (role === 'MANAGER') {
                return {
                    OR: [
                        { assigned_to: id },
                        { assignedTo: { manager_id: id } }
                    ]
                };
            }
        }

        return {};
    }

    /**
     * Get KPIs comparing current month with previous month.
     */
    async getKPIs(user) {
        const { id, role } = user;
        const now = new Date();
        const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const leadScope = this._getScope(user, 'lead');
        const dealScope = this._getScope(user, 'deal');

        // 1. Leads Stats
        const currentLeads = await prisma.lead.count({
            where: {
                ...leadScope,
                createdAt: { gte: firstDayCurrentMonth }
            }
        });
        const lastLeads = await prisma.lead.count({
            where: {
                ...leadScope,
                createdAt: { gte: firstDayLastMonth, lt: firstDayCurrentMonth }
            }
        });

        // 2. Won Deals Stats
        const currentWon = await prisma.deal.findMany({
            where: {
                ...dealScope,
                status: 'WON',
                createdAt: { gte: firstDayCurrentMonth }
            }
        });
        const lastWon = await prisma.deal.findMany({
            where: {
                ...dealScope,
                status: 'WON',
                createdAt: { gte: firstDayLastMonth, lt: firstDayCurrentMonth }
            }
        });

        const currentRevenue = currentWon.reduce((sum, d) => sum + parseFloat(d.value || 0), 0);
        const lastRevenue = lastWon.reduce((sum, d) => sum + parseFloat(d.value || 0), 0);

        // 3. Calculation helper for percentage change
        const getChange = (curr, last) => {
            if (last === 0) return curr > 0 ? '+100%' : '0%';
            const change = ((curr - last) / last) * 100;
            return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
        };

        const currentConversion = currentLeads > 0 ? (currentWon.length / currentLeads) * 100 : 0;
        const lastConversion = lastLeads > 0 ? (lastWon.length / lastLeads) * 100 : 0;

        const currentAvgDealSize = currentWon.length > 0 ? currentRevenue / currentWon.length : 0;
        const lastAvgDealSize = lastWon.length > 0 ? lastRevenue / lastWon.length : 0;

        return {
            leads: { value: currentLeads, change: getChange(currentLeads, lastLeads) },
            revenue: { value: currentRevenue, change: getChange(currentRevenue, lastRevenue) },
            avgDealSize: { value: currentAvgDealSize, change: getChange(currentAvgDealSize, lastAvgDealSize) },
            conversion: { 
                value: currentConversion.toFixed(1) + '%',
                change: getChange(currentConversion, lastConversion)
            },
            activeDeals: await prisma.deal.count({ 
                where: { ...dealScope, status: 'OPEN' }
            })
        };
    }

    /**
     * Get monthly revenue for the last 12 months.
     */
    async getMonthlyRevenue(user) {
        const results = [];
        const dealScope = this._getScope(user, 'deal');
        
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

            const deals = await prisma.deal.findMany({
                where: {
                    ...dealScope,
                    status: 'WON',
                    createdAt: { gte: monthStart, lte: monthEnd }
                },
                select: { value: true }
            });

            const total = deals.reduce((sum, deal) => sum + parseFloat(deal.value || 0), 0);
            
            results.push({
                month: monthStart.toLocaleString('default', { month: 'short' }),
                revenue: total
            });
        }

        return results;
    }

    /**
     * Get top performing agents based on Won deals.
     */
    async getTeamPerformance(user) {
        // Only for Managers and SuperAdmins
        if (user.role === 'AGENT') return [];

        const agents = await prisma.user.findMany({
            where: user.role === 'MANAGER' ? { manager_id: user.id } : { role: 'AGENT' },
            include: {
                deals: {
                    where: { status: 'WON' },
                    select: { value: true }
                }
            }
        });

        return agents.map(agent => ({
            name: agent.name,
            role: agent.title || 'Senior Agent',
            sales: agent.deals.reduce((sum, d) => sum + parseFloat(d.value || 0), 0),
            progress: Math.min(Math.round((agent.deals.length / 10) * 100), 100)
        })).sort((a, b) => b.sales - a.sales).slice(0, 5);
    }
}

module.exports = new ReportService();
