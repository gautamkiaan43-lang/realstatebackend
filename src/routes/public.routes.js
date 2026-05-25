const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

/**
 * PUBLIC endpoint — No auth required
 * GET /api/public/properties?brand=tosco
 * Returns only properties that are Published on the requested brand site
 */
router.get('/properties', async (req, res) => {
    try {
        const { brand } = req.query;

        // Fetch all non-archived properties
        const all = await prisma.property.findMany({
            where: { is_archived: false },
            select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                status: true,
                address: true,
                city: true,
                country: true,
                type: true,
                bedrooms: true,
                bathrooms: true,
                area: true,
                media: true,
                publishing: true,
                description: true,
            }
        });

        const parsed = all
            .map(p => {
                let pub = {};
                let media = [];
                try { pub = JSON.parse(p.publishing || '{}'); } catch (_) {}
                try { media = JSON.parse(p.media || '[]'); } catch (_) {}
                return { ...p, publishing: pub, media };
            })
            .filter(p => {
                if (!brand) return true; // no brand filter → return all
                const site = p.publishing[brand];
                return site && site.enabled && site.status === 'Published';
            });

        res.json({ status: 'success', data: { properties: parsed } });
    } catch (error) {
        res.status(500).json({ status: 'fail', message: error.message });
    }
});

module.exports = router;
