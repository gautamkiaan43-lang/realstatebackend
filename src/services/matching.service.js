const prisma = require('../config/prisma');

class MatchingService {
    /**
     * Suggests properties for a given lead based on affinity data.
     * @param {number} leadId 
     * @returns {Promise<Array>} - List of suggested properties with match scores
     */
    async suggestProperties(leadId) {
        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(leadId) }
        });

        if (!lead) throw new Error('Lead not found');

        const { budget, location_interest, property_type_interest } = lead;

        // Base Query: Available properties that are not archived
        const properties = await prisma.property.findMany({
            where: {
                is_archived: false,
                status: 'AVAILABLE'
            },
            take: 20
        });

        // Scoring Logic
        const scoredProperties = properties.map(property => {
            let score = 0;

            // 1. Budget Match (40 points)
            if (budget) {
                const price = Number(property.price);
                const leadBudget = Number(budget);

                if (price <= leadBudget) score += 40;
                else if (price <= leadBudget * 1.2) score += 20; // 20% over budget
            }

            // 2. Type Match (30 points)
            if (property_type_interest && property.type.toLowerCase() === property_type_interest.toLowerCase()) {
                score += 30;
            }

            // 3. Location Match (30 points)
            if (location_interest && property.city?.toLowerCase().includes(location_interest.toLowerCase())) {
                score += 30;
            }

            return {
                ...property,
                match_score: score / 100 // Normalized 0-1
            };
        });

        // Sort by score and return top matches
        return scoredProperties
            .filter(p => p.match_score > 0)
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, 5);
    }
}

module.exports = new MatchingService();
