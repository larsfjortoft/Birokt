import { Router } from 'express';

import authRoutes from './auth.routes.js';
import apiaryRoutes from './apiary.routes.js';
import hiveRoutes from './hive.routes.js';
import inspectionRoutes from './inspection.routes.js';
import photoRoutes from './photo.routes.js';
import treatmentRoutes from './treatment.routes.js';
import feedingRoutes from './feeding.routes.js';
import productionRoutes from './production.routes.js';
import statsRoutes from './stats.routes.js';
import weatherRoutes from './weather.routes.js';
import queenRoutes from './queen.routes.js';
import notificationRoutes from './notification.routes.js';
import searchRoutes from './search.routes.js';
import calendarRoutes from './calendar.routes.js';
import journalRoutes from './journal.routes.js';
import agentRoutes from './agent.routes.js';
import placementRoutes from './placement.routes.js';
import medicineAcquisitionRoutes from './medicineAcquisition.routes.js';
import complianceRoutes from './compliance.routes.js';
import productionBatchRoutes from './productionBatch.routes.js';
import documentRoutes from './document.routes.js';

const router = Router();

// API routes
router.use('/auth', authRoutes);
router.use('/apiaries', apiaryRoutes);
router.use('/hives', hiveRoutes);
router.use('/inspections', inspectionRoutes);
router.use('/photos', photoRoutes);
router.use('/treatments', treatmentRoutes);
router.use('/feedings', feedingRoutes);
router.use('/production', productionRoutes);
router.use('/stats', statsRoutes);
router.use('/weather', weatherRoutes);
router.use('/queens', queenRoutes);
router.use('/notifications', notificationRoutes);
router.use('/search', searchRoutes);
router.use('/calendar', calendarRoutes);
router.use('/journal', journalRoutes);
router.use('/agent', agentRoutes);
router.use('/placements', placementRoutes);
router.use('/medicine-acquisitions', medicineAcquisitionRoutes);
router.use('/compliance-events', complianceRoutes);
router.use('/production-batches', productionBatchRoutes);
router.use('/documents', documentRoutes);

export { router as v1Routes };
export default router;
