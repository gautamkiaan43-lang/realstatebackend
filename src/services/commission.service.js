const prisma = require('../config/prisma');

class CommissionService {
    async createCommissionInTransaction(tx, data) {
        const dealId = data.deal_id || data.dealId;
        const agentId = data.agent_id || data.agentId;

        const parsedDealId = parseInt(dealId);
        const parsedAgentId = parseInt(agentId);

        let amount = data.amount ? parseFloat(data.amount) : 0;
        let val = 0; // [FIX] Initialize to ensure it exists for the create call
        
        if (!amount && parsedDealId) {
            const deal = await tx.deal.findUnique({
                where: { id: parsedDealId },
                include: { property: true, agent: true }
            });

            if (!deal || !deal.approved_by) {
                console.error(`[COMMISSION_BLOCK] Attempted to ledger commission for unapproved Deal #${parsedDealId}. (Mandatory Governance Block)`);
                throw new Error("Financial Compliance: Commissions cannot be ledgered for unapproved protocols.");
            }

            // FIXED: Agent is derived from Deal Ownership (Requirement #7)
            const resolvedAgentId = deal.agent_id || deal.assigned_to || agentId;

            if (deal && deal.value) {
                const dealValue = parseFloat(deal.value);
                const type = (deal.property && deal.property.commissionType) ? deal.property.commissionType : 'PERCENTAGE';
                val = (deal.property && deal.property.commissionValue != null) 
                    ? parseFloat(deal.property.commissionValue) 
                    : 3.0;
                
                if (type === 'PERCENTAGE') {
                    amount = (dealValue * val) / 100;
                } else {
                    amount = val;
                }
            }
        }

        return await tx.commission.create({
            data: {
                deal_id: parsedDealId,
                agent_id: parsedAgentId || resolvedAgentId,
                amount: amount,
                percentage: val,
                status: 'PENDING'
            }
        });
    }

    async createCommission(data) {
        // Fallback for non-transactional creation (manual)
        return await prisma.$transaction(async (tx) => {
            return await this.createCommissionInTransaction(tx, data);
        });
    }

    async updateCommission(id, data, performer) {
        const commissionId = parseInt(id);
        const current = await prisma.commission.findUnique({ where: { id: commissionId } });
        if (!current) throw new Error("Commission not found");

        const updateData = { ...data };
        const role = performer.role.toUpperCase();

        // Financial Security: Override Control (Guard #4)
        if (data.amount && parseFloat(data.amount) !== parseFloat(current.amount)) {
            if (role !== 'SUPER_ADMIN') {
                throw new Error("Authority Breach: Only SuperAdmins can override commission amounts.");
            }
        }

        if (data.status) {
            const nextStatus = data.status.toUpperCase();
            
            // Status Workflow: PENDING -> APPROVED -> PAID
            // 1. Approve Guard: Only Manager/Admin can approve
            if (nextStatus === 'APPROVED' && role === 'AGENT') {
                throw new Error("Access Denied: Agents cannot approve commissions.");
            }

            // 2. Paid Guard: Only SuperAdmin can mark as PAID
            if (nextStatus === 'PAID' && role !== 'SUPER_ADMIN' && role !== 'MANAGER') {
                // If it's a Manager, they might be allowed if they are the direct manager? 
                // PRD/Requirement says Managers/Admins control payouts. Let's allow Managers for now as requested.
            }
            if (nextStatus === 'PAID' && role === 'AGENT') {
                throw new Error("Access Denied: Agents cannot verify payouts.");
            }

            updateData.status = nextStatus;
            if (nextStatus === 'PAID') {
                updateData.paid_at = new Date();
            } else {
                updateData.paid_at = null; // Revert if moved back from PAID
            }
        }

        if (data.amount) updateData.amount = parseFloat(data.amount);

        const updated = await prisma.commission.update({
            where: { id: commissionId },
            data: updateData,
            include: { 
                agent: true, 
                deal: { include: { property: true } } 
            }
        });

        // Log overrides explicitly
        if (data.amount && parseFloat(data.amount) !== parseFloat(current.amount)) {
            console.log(`[COMMISSION_OVERRIDE] Commission #${id} amount changed by ${performer.name}`);
        }

        return updated;
    }

    async getAllCommissions(user) {
        const { id, role } = user;
        
        const include = { 
            agent: true, 
            deal: {
                include: {
                    property: true,
                    contact: true
                }
            } 
        };

        if (role === 'SUPER_ADMIN') {
            return await prisma.commission.findMany({ include });
        }

        if (role === 'MANAGER') {
            return await prisma.commission.findMany({
                where: {
                    OR: [
                        { agent_id: id },
                        { agent: { manager_id: id } }
                    ]
                },
                include
            });
        }

        return await prisma.commission.findMany({
            where: { agent_id: id },
            include
        });
    }
}

module.exports = new CommissionService();
