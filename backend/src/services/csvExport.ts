import prisma from '../utils/prisma.js';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(',');
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

export async function exportInspectionsCsv(userId: string, year?: number): Promise<string> {
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

  const yearFilter = year ? {
    inspectionDate: {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31, 23, 59, 59),
    },
  } : {};

  const inspections = await prisma.inspection.findMany({
    where: { hiveId: { in: hiveIds }, ...yearFilter },
    include: {
      hive: {
        select: { hiveNumber: true, apiary: { select: { name: true } } },
      },
    },
    orderBy: { inspectionDate: 'desc' },
  });

  const headers = [
    'Dato', 'Bigard', 'Kube', 'Styrke', 'Temperament',
    'Dronning sett', 'Legger egg', 'Yngelrammer', 'Honningrammer',
    'Pollenrammer', 'Tomme rammer', 'Helsestatus', 'Varroatrykk',
    'Temperatur', 'Vind', 'Vaer', 'Notater',
  ];

  const rows = inspections.map(i => [
    formatDate(i.inspectionDate),
    i.hive.apiary.name,
    i.hive.hiveNumber,
    i.strength || '',
    i.temperament || '',
    i.queenSeen ? 'Ja' : 'Nei',
    i.queenLaying ? 'Ja' : 'Nei',
    i.broodFrames,
    i.honeyFrames,
    i.pollenFrames,
    i.emptyFrames,
    i.healthStatus,
    i.varroaLevel || '',
    i.temperature ?? '',
    i.windSpeed ?? '',
    i.weatherCondition || '',
    i.notes || '',
  ]);

  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
}

export async function exportTreatmentsCsv(userId: string, year?: number): Promise<string> {
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

  const yearFilter = year ? {
    treatmentDate: {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31, 23, 59, 59),
    },
  } : {};

  const treatments = await prisma.treatment.findMany({
    where: { hiveId: { in: hiveIds }, ...yearFilter },
    include: {
      hive: {
        select: { hiveNumber: true, apiary: { select: { name: true } } },
      },
    },
    orderBy: { treatmentDate: 'desc' },
  });

  const headers = [
    'Dato', 'Bigard', 'Kube', 'Produkt', 'Produkttype',
    'Mal', 'Dosering', 'Startdato', 'Sluttdato',
    'Tilbakeholdelsesdager', 'Tilbakeholdelse slutt', 'Notater',
  ];

  const rows = treatments.map(t => [
    formatDate(t.treatmentDate),
    t.hive.apiary.name,
    t.hive.hiveNumber,
    t.productName,
    t.productType || '',
    t.target || '',
    t.dosage || '',
    formatDate(t.startDate),
    formatDate(t.endDate),
    t.withholdingPeriodDays ?? '',
    formatDate(t.withholdingEndDate),
    t.notes || '',
  ]);

  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
}

export async function exportFeedingsCsv(userId: string, year?: number): Promise<string> {
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

  const yearFilter = year ? {
    feedingDate: {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31, 23, 59, 59),
    },
  } : {};

  const feedings = await prisma.feeding.findMany({
    where: { hiveId: { in: hiveIds }, ...yearFilter },
    include: {
      hive: {
        select: { hiveNumber: true, apiary: { select: { name: true } } },
      },
    },
    orderBy: { feedingDate: 'desc' },
  });

  const headers = [
    'Dato', 'Bigard', 'Kube', 'Fortype', 'Mengde (kg)',
    'Sukkerkonsentrasjon (%)', 'Arsak', 'Notater',
  ];

  const rows = feedings.map(f => [
    formatDate(f.feedingDate),
    f.hive.apiary.name,
    f.hive.hiveNumber,
    f.feedType,
    f.amountKg,
    f.sugarConcentration ?? '',
    f.reason || '',
    f.notes || '',
  ]);

  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
}

export async function exportProductionCsv(userId: string, year?: number): Promise<string> {
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

  const yearFilter = year ? {
    harvestDate: {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31, 23, 59, 59),
    },
  } : {};

  const production = await prisma.production.findMany({
    where: {
      OR: [
        { hiveId: { in: hiveIds } },
        { apiaryId: { in: apiaryIds } },
      ],
      ...yearFilter,
    },
    include: {
      hive: { select: { hiveNumber: true } },
      apiary: { select: { name: true } },
    },
    orderBy: { harvestDate: 'desc' },
  });

  const headers = [
    'Hostdato', 'Bigard', 'Kube', 'Produkttype', 'Honningtype',
    'Mengde (kg)', 'Kvalitet', 'Fuktighet (%)',
    'Pris per kg', 'Total inntekt', 'Solgt til', 'Salgsdato', 'Notater',
  ];

  const rows = production.map(p => [
    formatDate(p.harvestDate),
    p.apiary?.name || '',
    p.hive?.hiveNumber || '',
    p.productType,
    p.honeyType || '',
    p.amountKg,
    p.qualityGrade || '',
    p.moistureContent ?? '',
    p.pricePerKg ?? '',
    p.totalRevenue ?? '',
    p.soldTo || '',
    formatDate(p.saleDate),
    p.notes || '',
  ]);

  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
}
