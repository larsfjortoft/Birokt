import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.js';
import prisma from '../utils/prisma.js';
import { cacheResponse } from '../middleware/cacheMiddleware.js';
import {
  exportInspectionsCsv,
  exportTreatmentsCsv,
  exportFeedingsCsv,
  exportProductionCsv,
} from '../services/csvExport.js';
import {
  generateSeasonReport,
  generateHiveReport,
  generateApiaryReport,
} from '../services/pdfReport.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const overviewQuerySchema = z.object({
  year: z.string().transform(Number).pipe(z.number().int().min(2000).max(2100)).optional(),
  apiaryId: z.string().uuid().optional(),
});

const hiveStatsParamSchema = z.object({
  id: z.string().uuid(),
});

const hiveStatsQuerySchema = z.object({
  year: z.string().transform(Number).pipe(z.number().int().min(2000).max(2100)).optional(),
});

// GET /stats/overview - Get overview statistics
router.get('/overview', validateQuery(overviewQuerySchema), cacheResponse(120), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const year = Number(req.query.year as string) || new Date().getFullYear();
    const apiaryId = req.query.apiaryId as string | undefined;

    // Get user's apiaries
    const userApiaries = await prisma.userApiary.findMany({
      where: {
        userId,
        ...(apiaryId && { apiaryId }),
      },
      select: { apiaryId: true },
    });
    const apiaryIds = userApiaries.map(ua => ua.apiaryId);

    // Get apiaries stats
    const apiaries = await prisma.apiary.findMany({
      where: { id: { in: apiaryIds } },
    });

    const activeApiaries = apiaries.filter(a => a.active).length;

    // Get hives stats
    const hives = await prisma.hive.findMany({
      where: { apiaryId: { in: apiaryIds } },
    });

    const hiveStats = {
      total: hives.length,
      active: hives.filter(h => h.status === 'active').length,
      nuc: hives.filter(h => h.status === 'nuc').length,
      byStrength: {
        strong: hives.filter(h => h.strength === 'strong').length,
        medium: hives.filter(h => h.strength === 'medium').length,
        weak: hives.filter(h => h.strength === 'weak').length,
      },
    };

    // Get hive IDs for further queries
    const hiveIds = hives.map(h => h.id);

    // Get inspections stats for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const inspections = await prisma.inspection.findMany({
      where: {
        hiveId: { in: hiveIds },
        inspectionDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });

    // Get this month's inspections
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthInspections = inspections.filter(
      i => i.inspectionDate >= monthStart
    ).length;

    // Get health stats from latest inspections per hive
    const latestInspectionsByHive = new Map<string, typeof inspections[0]>();
    for (const inspection of inspections) {
      const existing = latestInspectionsByHive.get(inspection.hiveId);
      if (!existing || inspection.inspectionDate > existing.inspectionDate) {
        latestInspectionsByHive.set(inspection.hiveId, inspection);
      }
    }

    const healthStats = {
      healthy: 0,
      warning: 0,
      critical: 0,
    };

    for (const inspection of latestInspectionsByHive.values()) {
      if (inspection.healthStatus === 'healthy') healthStats.healthy++;
      else if (inspection.healthStatus === 'warning') healthStats.warning++;
      else if (inspection.healthStatus === 'critical') healthStats.critical++;
    }

    // Get production stats
    const production = await prisma.production.aggregate({
      where: {
        OR: [
          { hiveId: { in: hiveIds } },
          { apiaryId: { in: apiaryIds } },
        ],
        harvestDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _sum: {
        amountKg: true,
        totalRevenue: true,
      },
    });

    // Get honey and wax separately
    const honeyProduction = await prisma.production.aggregate({
      where: {
        OR: [
          { hiveId: { in: hiveIds } },
          { apiaryId: { in: apiaryIds } },
        ],
        productType: 'honey',
        harvestDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _sum: {
        amountKg: true,
      },
    });

    const waxProduction = await prisma.production.aggregate({
      where: {
        OR: [
          { hiveId: { in: hiveIds } },
          { apiaryId: { in: apiaryIds } },
        ],
        productType: 'wax',
        harvestDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _sum: {
        amountKg: true,
      },
    });

    // Get treatments stats
    const treatments = await prisma.treatment.findMany({
      where: {
        hiveId: { in: hiveIds },
        treatmentDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });

    const activeWithholdings = treatments.filter(
      t => t.withholdingEndDate && t.withholdingEndDate >= now
    ).length;

    sendSuccess(res, {
      year,
      apiaries: {
        total: apiaries.length,
        active: activeApiaries,
      },
      hives: {
        ...hiveStats,
        byHealth: healthStats,
      },
      inspections: {
        total: inspections.length,
        thisMonth: thisMonthInspections,
        avgPerHive: hives.length > 0 ? (inspections.length / hives.length).toFixed(1) : 0,
      },
      production: {
        honeyKg: honeyProduction._sum.amountKg || 0,
        waxKg: waxProduction._sum.amountKg || 0,
        totalRevenue: production._sum.totalRevenue || 0,
      },
      treatments: {
        total: treatments.length,
        activeWithholdings,
      },
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get statistics', 500);
  }
});

// GET /stats/hive/:id - Get statistics for a specific hive
router.get('/hive/:id', validateParams(hiveStatsParamSchema), validateQuery(hiveStatsQuerySchema), cacheResponse(120), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: hiveId } = req.params;
    const year = Number(req.query.year as string) || new Date().getFullYear();

    // Get hive and check access
    const hive = await prisma.hive.findUnique({
      where: { id: hiveId },
      include: {
        apiary: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!hive) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Hive not found', 404);
      return;
    }

    // Check access
    const userApiary = await prisma.userApiary.findUnique({
      where: {
        userId_apiaryId: { userId, apiaryId: hive.apiaryId },
      },
    });

    if (!userApiary) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    // Get inspections
    const inspections = await prisma.inspection.findMany({
      where: {
        hiveId,
        inspectionDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      orderBy: { inspectionDate: 'asc' },
    });

    // Calculate average strength
    const strengthValues = { weak: 1, medium: 2, strong: 3 };
    const strengthScores = inspections
      .filter(i => i.strength)
      .map(i => strengthValues[i.strength as keyof typeof strengthValues] || 2);
    const avgStrengthScore = strengthScores.length > 0
      ? strengthScores.reduce((a, b) => a + b, 0) / strengthScores.length
      : 2;
    const avgStrength = avgStrengthScore <= 1.5 ? 'weak' : avgStrengthScore <= 2.5 ? 'medium' : 'strong';

    // Count health issues
    const healthIssues = inspections.filter(
      i => i.healthStatus === 'warning' || i.healthStatus === 'critical'
    ).length;

    // Get production
    const production = await prisma.production.aggregate({
      where: {
        hiveId,
        harvestDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _sum: {
        amountKg: true,
      },
    });

    const honeyProduction = await prisma.production.aggregate({
      where: {
        hiveId,
        productType: 'honey',
        harvestDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _sum: {
        amountKg: true,
      },
    });

    const waxProduction = await prisma.production.aggregate({
      where: {
        hiveId,
        productType: 'wax',
        harvestDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _sum: {
        amountKg: true,
      },
    });

    // Get treatments
    const treatments = await prisma.treatment.findMany({
      where: {
        hiveId,
        treatmentDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });

    const treatmentTypes = [...new Set(treatments.map(t => t.target).filter(Boolean))];

    // Get feedings
    const feedings = await prisma.feeding.aggregate({
      where: {
        hiveId,
        feedingDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _count: true,
      _sum: {
        amountKg: true,
      },
    });

    // Build timeline
    const timeline: Array<Record<string, unknown>> = [
      ...inspections.map(i => ({
        date: i.inspectionDate.toISOString().split('T')[0],
        type: 'inspection' as const,
        strength: i.strength,
        healthStatus: i.healthStatus,
      })),
    ];

    const feedingRecords = await prisma.feeding.findMany({
      where: {
        hiveId,
        feedingDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });

    timeline.push(
      ...feedingRecords.map(f => ({
        date: f.feedingDate.toISOString().split('T')[0],
        type: 'feeding' as const,
        amountKg: f.amountKg,
      }))
    );

    timeline.push(
      ...treatments.map(t => ({
        date: t.treatmentDate.toISOString().split('T')[0],
        type: 'treatment' as const,
        product: t.productName,
      }))
    );

    // Sort by date
    timeline.sort((a, b) => (a.date as string).localeCompare(b.date as string));

    sendSuccess(res, {
      hiveId,
      hiveNumber: hive.hiveNumber,
      year,
      inspections: {
        total: inspections.length,
        avgStrength,
        healthIssues,
      },
      production: {
        honeyKg: honeyProduction._sum.amountKg || 0,
        waxKg: waxProduction._sum.amountKg || 0,
      },
      treatments: {
        total: treatments.length,
        types: treatmentTypes,
      },
      feedings: {
        total: feedings._count || 0,
        totalKg: feedings._sum.amountKg || 0,
      },
      timeline: timeline.slice(0, 50), // Limit to 50 items
    });
  } catch (error) {
    console.error('Get hive stats error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get hive statistics', 500);
  }
});

// GET /stats/charts - Get chart data for visualization
router.get('/charts', cacheResponse(120), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const year = Number(req.query.year as string) || new Date().getFullYear();

    const userApiaries = await prisma.userApiary.findMany({
      where: { userId },
      select: { apiaryId: true },
    });
    const apiaryIds = userApiaries.map(ua => ua.apiaryId);
    const hives = await prisma.hive.findMany({
      where: { apiaryId: { in: apiaryIds } },
      select: { id: true },
    });
    const hiveIds = hives.map(h => h.id);

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    // Monthly production data
    const productionRecords = await prisma.production.findMany({
      where: {
        OR: [{ hiveId: { in: hiveIds } }, { apiaryId: { in: apiaryIds } }],
        productType: 'honey',
        harvestDate: { gte: yearStart, lte: yearEnd },
      },
      select: { harvestDate: true, amountKg: true },
    });

    const monthlyProduction = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleDateString('nb-NO', { month: 'short' }),
      honeyKg: 0,
    }));

    for (const p of productionRecords) {
      const month = p.harvestDate.getMonth();
      monthlyProduction[month].honeyKg += Number(p.amountKg);
    }

    // Monthly inspection health data
    const inspections = await prisma.inspection.findMany({
      where: {
        hiveId: { in: hiveIds },
        inspectionDate: { gte: yearStart, lte: yearEnd },
      },
      select: { inspectionDate: true, healthStatus: true, strength: true },
    });

    const monthlyHealth = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i, 1).toLocaleDateString('nb-NO', { month: 'short' }),
      healthy: 0,
      warning: 0,
      critical: 0,
    }));

    for (const insp of inspections) {
      const month = insp.inspectionDate.getMonth();
      if (insp.healthStatus === 'healthy') monthlyHealth[month].healthy++;
      else if (insp.healthStatus === 'warning') monthlyHealth[month].warning++;
      else if (insp.healthStatus === 'critical') monthlyHealth[month].critical++;
    }

    // Treatment timeline
    const treatments = await prisma.treatment.findMany({
      where: {
        hiveId: { in: hiveIds },
        treatmentDate: { gte: yearStart, lte: yearEnd },
      },
      select: { treatmentDate: true, productName: true, target: true },
      orderBy: { treatmentDate: 'asc' },
    });

    const treatmentTimeline = treatments.map(t => ({
      date: t.treatmentDate.toISOString().split('T')[0],
      product: t.productName,
      target: t.target || '',
    }));

    sendSuccess(res, {
      year,
      monthlyProduction,
      monthlyHealth,
      treatmentTimeline,
    });
  } catch (error) {
    console.error('Get chart data error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get chart data', 500);
  }
});

// GET /stats/export/csv - Export data as CSV
const csvExportQuerySchema = z.object({
  type: z.enum(['inspections', 'treatments', 'feedings', 'production']),
  year: z.string().transform(Number).pipe(z.number().int().min(2000).max(2100)).optional(),
});

router.get('/export/csv', validateQuery(csvExportQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const type = req.query.type as string;
    const year = req.query.year as number | undefined;

    let csv: string;
    let filename: string;

    switch (type) {
      case 'inspections':
        csv = await exportInspectionsCsv(userId, year);
        filename = `inspeksjoner${year ? `-${year}` : ''}.csv`;
        break;
      case 'treatments':
        csv = await exportTreatmentsCsv(userId, year);
        filename = `behandlinger${year ? `-${year}` : ''}.csv`;
        break;
      case 'feedings':
        csv = await exportFeedingsCsv(userId, year);
        filename = `foringer${year ? `-${year}` : ''}.csv`;
        break;
      case 'production':
        csv = await exportProductionCsv(userId, year);
        filename = `produksjon${year ? `-${year}` : ''}.csv`;
        break;
      default:
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid export type', 400);
        return;
    }

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bom + csv);
  } catch (error) {
    console.error('CSV export error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to export CSV', 500);
  }
});

// GET /stats/report/pdf - Generate PDF report
const pdfReportQuerySchema = z.object({
  type: z.enum(['season', 'hive', 'apiary']),
  year: z.string().transform(Number).pipe(z.number().int().min(2000).max(2100)).optional(),
  id: z.string().uuid().optional(),
});

router.get('/report/pdf', validateQuery(pdfReportQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const type = req.query.type as string;
    const year = Number(req.query.year as string) || new Date().getFullYear();
    const id = req.query.id as string | undefined;

    let pdfBuffer: Buffer;
    let filename: string;

    switch (type) {
      case 'season':
        pdfBuffer = await generateSeasonReport(userId, year);
        filename = `sesongrapport-${year}.pdf`;
        break;
      case 'hive':
        if (!id) {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Hive ID is required for hive reports', 400);
          return;
        }
        pdfBuffer = await generateHiveReport(userId, id, year);
        filename = `kuberapport-${year}.pdf`;
        break;
      case 'apiary':
        if (!id) {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Apiary ID is required for apiary reports', 400);
          return;
        }
        pdfBuffer = await generateApiaryReport(userId, id, year);
        filename = `bigardrapport-${year}.pdf`;
        break;
      default:
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid report type', 400);
        return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF report error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate PDF report', 500);
  }
});

export default router;
