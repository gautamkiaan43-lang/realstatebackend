const prisma = require('../config/prisma');

class AssignmentService {
    /**
     * Finds the next available agent using simple Round-Robin (Least Recently Assigned)
     * @param {number|null} managerId - The manager whose team we are assigning to
     * @param {string} creatorRole - The role of the person creating the lead
     * @returns {Promise<number|null>} - The assigned Agent ID
     */
    async findNextAgent(managerId, creatorRole = 'AGENT') {
        const query = {
            role: 'AGENT'
        };

        // If not a Super Admin, filter by manager
        if (creatorRole !== 'SUPER_ADMIN' && managerId) {
            query.manager_id = managerId;
        }

        // 1. Get all eligible agents
        const agents = await prisma.user.findMany({
            where: query,
            select: {
                id: true,
                ownedLeads: {
                    select: { createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (agents.length === 0) {
            console.log(`[AssignmentService] No Agents found for Role: ${creatorRole}, ManagerID: ${managerId}`);
            return null;
        }

        // 2. Sort by the timestamp of their last assigned lead (asc = oldest first)
        const sortedAgents = agents.sort((a, b) => {
            const timeA = a.ownedLeads[0] ? new Date(a.ownedLeads[0].createdAt).getTime() : 0;
            const timeB = b.ownedLeads[0] ? new Date(b.ownedLeads[0].createdAt).getTime() : 0;
            return timeA - timeB;
        });

        return sortedAgents[0].id;
    }

    /**
     * Executes automatic assignment for a newly created lead
     * @param {number} leadId - The lead to assign
     * @param {number|null} managerId - The manager context
     * @param {string} creatorRole - The role context
     */
    async autoAssignLead(leadId, managerId, creatorRole) {
        // If not super admin AND no manager id, we can't assign
        if (creatorRole !== 'SUPER_ADMIN' && !managerId) return;

        const nextAgentId = await this.findNextAgent(managerId, creatorRole);
        if (!nextAgentId) return;

        await prisma.lead.update({
            where: { id: leadId },
            data: { owner_id: nextAgentId }
        });

        return nextAgentId;
    }
}

module.exports = new AssignmentService();
