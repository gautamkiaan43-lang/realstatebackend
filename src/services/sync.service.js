const prisma = require('../config/prisma');

class SyncService {
    /**
     * Publish or Unpublish a property on a specific site.
     */
    async publishToSite(propertyId, siteKey, performerId) {
        // Support searching by both numeric ID and slug
        let propId = parseInt(propertyId);
        let property;

        if (!isNaN(propId)) {
            property = await prisma.property.findUnique({
                where: { id: propId }
            });
        } else {
            // Fallback: Try searching by slug if the propertyId is a string (e.g. CUID or Slug)
            property = await prisma.property.findUnique({
                where: { slug: propertyId }
            });
            if (property) propId = property.id;
        }

        if (!property) throw new Error(`Asset not found: No property matching ID or Slug "${propertyId}".`);

        // 1. Update Property Publishing State
        const publishing = property.publishing || {};
        const isCurrentlyEnabled = publishing[siteKey]?.enabled || false;
        const newStatus = isCurrentlyEnabled ? 'Unpublished' : 'Published';
        
        const updatedPublishing = {
            ...publishing,
            [siteKey]: {
                enabled: !isCurrentlyEnabled,
                status: newStatus,
                lastSync: new Date().toISOString()
            }
        };

        const updatedProperty = await prisma.property.update({
            where: { id: propId },
            data: { publishing: updatedPublishing }
        });

        // 2. Create Log Entry
        const action = isCurrentlyEnabled ? 'UNPUBLISH' : 'PUBLISH';
        await prisma.publishingLog.create({
            data: {
                propertyId: propId,
                siteKey,
                action,
                status: 'SUCCESS',
                message: `Successfully ${action.toLowerCase()}ed property on ${siteKey}`
            }
        });

        // 3. Clear any existing errors for this site/property if successful
        await prisma.syncError.updateMany({
            where: { propertyId: propId, siteKey, isResolved: false },
            data: { isResolved: true }
        });

        return {
            success: true,
            property: updatedProperty,
            log: {
                message: `Property ${newStatus} on ${siteKey}`,
                timestamp: new Date()
            }
        };
    }

    /**
     * Get aggregated synchronization stats.
     */
    async getStats() {
        const websites = await prisma.websiteConfig.findMany();
        const activeErrors = await prisma.syncError.count({ where: { isResolved: false } });
        
        // Mocking some dynamic health metrics based on lastSync
        const stats = websites.map(site => {
            const lastSync = site.lastSync ? new Date(site.lastSync) : null;
            const isStale = lastSync && (new Date() - lastSync > 3600000 * 24); // > 24h
            
            return {
                id: site.id,
                name: site.name,
                domain: site.domain,
                status: site.status,
                ping: isStale ? '150ms' : '15ms', // Stale sites "feel" slower in this mock
                load: site.status === 'connected' ? '12%' : '0%',
                lastSync: site.lastSync
            };
        });

        return {
            sites: stats,
            totalErrors: activeErrors,
            systemStatus: activeErrors > 5 ? 'Degraded' : 'Optimal'
        };
    }

    /**
     * Get latest activity logs.
     */
    async getActivityLogs(limit = 10) {
        return await prisma.publishingLog.findMany({
            take: limit,
            orderBy: { timestamp: 'desc' },
            include: {
                property: {
                    select: { title: true }
                }
            }
        });
    }

    /**
     * Get unresolved sync errors.
     */
    async getSyncErrors() {
        return await prisma.syncError.findMany({
            where: { isResolved: false },
            orderBy: { createdAt: 'desc' },
            include: {
                property: {
                    select: { title: true, price: true }
                }
            }
        });
    }

    /**
     * Force a global resync for all properties on all sites.
     */
    async forceResync(performerId) {
        // In a real app, this would trigger a background worker.
        // For this demo, we'll log a mass-sync event.
        const sites = await prisma.websiteConfig.findMany({ where: { status: 'connected' } });
        
        await prisma.publishingLog.create({
            data: {
                siteKey: 'SYSTEM',
                action: 'GLOBAL_SYNC',
                status: 'SUCCESS',
                message: `Forced global synchronization triggered for ${sites.length} sites.`
            }
        });

        // Update all sites lastSync
        await prisma.websiteConfig.updateMany({
            data: { lastSync: new Date() }
        });

        return { success: true, message: 'Global synchronization initiated.' };
    }

    /**
     * Retry a specific error.
     */
    async retryError(errorId) {
        const error = await prisma.syncError.findUnique({ where: { id: parseInt(errorId) } });
        if (!error) throw new Error('Error record not found');

        // Simulate retry success
        await prisma.syncError.update({
            where: { id: error.id },
            data: { isResolved: true, retryCount: error.retryCount + 1 }
        });

        return this.publishToSite(error.propertyId, error.siteKey);
    }
}

module.exports = new SyncService();
