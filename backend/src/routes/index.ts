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

export { router as v1Routes };
export default router;
