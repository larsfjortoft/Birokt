import PDFDocument from 'pdfkit';
import prisma from '../utils/prisma.js';

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('nb-NO');
}

async function getUserData(userId: string) {
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
  return { apiaryIds, hiveIds };
}

export async function generateSeasonReport(userId: string, year: number): Promise<Buffer> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const { apiaryIds, hiveIds } = await getUserData(userId);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const apiaries = await prisma.apiary.findMany({
    where: { id: { in: apiaryIds } },
    include: { hives: true },
  });

  const inspections = await prisma.inspection.findMany({
    where: { hiveId: { in: hiveIds }, inspectionDate: { gte: yearStart, lte: yearEnd } },
    include: { hive: { select: { hiveNumber: true, apiary: { select: { name: true } } } } },
    orderBy: { inspectionDate: 'asc' },
  });

  const treatments = await prisma.treatment.findMany({
    where: { hiveId: { in: hiveIds }, treatmentDate: { gte: yearStart, lte: yearEnd } },
    include: { hive: { select: { hiveNumber: true, apiary: { select: { name: true } } } } },
    orderBy: { treatmentDate: 'asc' },
  });

  const production = await prisma.production.aggregate({
    where: {
      OR: [{ hiveId: { in: hiveIds } }, { apiaryId: { in: apiaryIds } }],
      harvestDate: { gte: yearStart, lte: yearEnd },
    },
    _sum: { amountKg: true, totalRevenue: true },
  });

  const honeyProduction = await prisma.production.aggregate({
    where: {
      OR: [{ hiveId: { in: hiveIds } }, { apiaryId: { in: apiaryIds } }],
      productType: 'honey',
      harvestDate: { gte: yearStart, lte: yearEnd },
    },
    _sum: { amountKg: true },
  });

  const feedings = await prisma.feeding.aggregate({
    where: { hiveId: { in: hiveIds }, feedingDate: { gte: yearStart, lte: yearEnd } },
    _sum: { amountKg: true },
    _count: true,
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Sesongrapport', { align: 'center' });
    doc.fontSize(16).font('Helvetica').text(`${year}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Birokt — ${user?.name || 'Ukjent birakter'}`, { align: 'center' });
    doc.fontSize(10).text(`Generert: ${new Date().toLocaleDateString('nb-NO')}`, { align: 'center' });
    doc.moveDown(1.5);

    // Separator
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#f59e0b');
    doc.moveDown(1);

    // Summary section
    doc.fontSize(16).font('Helvetica-Bold').text('Oppsummering');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');

    const totalHives = apiaries.reduce((sum, a) => sum + a.hives.length, 0);
    const activeHives = apiaries.reduce(
      (sum, a) => sum + a.hives.filter(h => h.status === 'active').length, 0
    );

    const summaryData = [
      ['Antall bigårder:', `${apiaries.length}`],
      ['Totalt kuber:', `${totalHives} (${activeHives} aktive)`],
      ['Antall inspeksjoner:', `${inspections.length}`],
      ['Antall behandlinger:', `${treatments.length}`],
      ['Antall fôringer:', `${feedings._count}`],
      ['Honningproduksjon:', `${honeyProduction._sum.amountKg || 0} kg`],
      ['Total produksjon:', `${production._sum.amountKg || 0} kg`],
      ['Total fôring:', `${feedings._sum.amountKg || 0} kg`],
    ];

    for (const [label, value] of summaryData) {
      doc.font('Helvetica-Bold').text(label, 50, doc.y, { continued: true, width: 200 });
      doc.font('Helvetica').text(` ${value}`);
    }

    doc.moveDown(1);

    // Apiaries section
    doc.fontSize(16).font('Helvetica-Bold').text('Bigårder');
    doc.moveDown(0.5);

    for (const apiary of apiaries) {
      doc.fontSize(13).font('Helvetica-Bold').text(apiary.name);
      const activeCount = apiary.hives.filter(h => h.status === 'active').length;
      doc.fontSize(10).font('Helvetica')
        .text(`${apiary.hives.length} kuber (${activeCount} aktive) — ${apiary.locationName || 'Ingen lokasjon'}`);
      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);

    // Treatments section (important for Mattilsynet)
    doc.fontSize(16).font('Helvetica-Bold').text('Behandlinger');
    doc.moveDown(0.5);

    if (treatments.length === 0) {
      doc.fontSize(10).font('Helvetica').text('Ingen behandlinger registrert denne sesongen.');
    } else {
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Dato', 50, doc.y, { width: 70, continued: false });

      // Table header
      const tableY = doc.y;
      doc.text('Dato', 50, tableY);
      doc.text('Bigård', 120, tableY);
      doc.text('Kube', 220, tableY);
      doc.text('Produkt', 270, tableY);
      doc.text('Mål', 380, tableY);
      doc.text('Tilbakeh.', 430, tableY);
      doc.moveDown(0.3);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
      doc.moveDown(0.2);

      doc.fontSize(9).font('Helvetica');
      for (const t of treatments) {
        if (doc.y > 720) {
          doc.addPage();
          doc.y = 50;
        }
        const rowY = doc.y;
        doc.text(formatDate(t.treatmentDate), 50, rowY);
        doc.text(t.hive.apiary.name, 120, rowY);
        doc.text(t.hive.hiveNumber, 220, rowY);
        doc.text(t.productName, 270, rowY);
        doc.text(t.target || '', 380, rowY);
        doc.text(formatDate(t.withholdingEndDate), 430, rowY);
        doc.moveDown(0.3);
      }
    }

    doc.moveDown(1);

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
      .text(
        'Denne rapporten er generert av Birokt — digitalt biroktverktoy. Kan brukes som dokumentasjon for Mattilsynet.',
        50, 770,
        { align: 'center', width: 495 }
      );

    doc.end();
  });
}

export async function generateHiveReport(userId: string, hiveId: string, year: number): Promise<Buffer> {
  const hive = await prisma.hive.findUnique({
    where: { id: hiveId },
    include: { apiary: { select: { name: true } } },
  });

  if (!hive) throw new Error('Hive not found');

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const inspections = await prisma.inspection.findMany({
    where: { hiveId, inspectionDate: { gte: yearStart, lte: yearEnd } },
    orderBy: { inspectionDate: 'asc' },
  });

  const treatments = await prisma.treatment.findMany({
    where: { hiveId, treatmentDate: { gte: yearStart, lte: yearEnd } },
    orderBy: { treatmentDate: 'asc' },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text(`Kuberapport — ${hive.hiveNumber}`, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(`${hive.apiary.name} — ${year}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(12).font('Helvetica-Bold').text('Kubeinformasjon');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Status: ${hive.status}`);
    doc.text(`Type: ${hive.hiveType}`);
    doc.text(`Kasser: ${hive.boxCount}`);
    if (hive.queenYear) doc.text(`Dronningens ar: ${hive.queenYear}`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text(`Inspeksjoner (${inspections.length})`);
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');

    for (const insp of inspections) {
      if (doc.y > 720) { doc.addPage(); doc.y = 50; }
      doc.font('Helvetica-Bold').text(`${formatDate(insp.inspectionDate)} — ${insp.healthStatus}`, { underline: true });
      doc.font('Helvetica');
      doc.text(`Styrke: ${insp.strength || '-'} | Temperament: ${insp.temperament || '-'} | Dronning sett: ${insp.queenSeen ? 'Ja' : 'Nei'}`);
      doc.text(`Rammer — Yngel: ${insp.broodFrames}, Honning: ${insp.honeyFrames}, Pollen: ${insp.pollenFrames}, Tomme: ${insp.emptyFrames}`);
      if (insp.notes) doc.text(`Notat: ${insp.notes}`);
      doc.moveDown(0.5);
    }

    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(`Behandlinger (${treatments.length})`);
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');

    for (const t of treatments) {
      if (doc.y > 720) { doc.addPage(); doc.y = 50; }
      doc.text(`${formatDate(t.treatmentDate)} — ${t.productName} (${t.target || '-'}) ${t.dosage ? '— ' + t.dosage : ''}`);
    }

    doc.end();
  });
}

export async function generateApiaryReport(userId: string, apiaryId: string, year: number): Promise<Buffer> {
  const apiary = await prisma.apiary.findUnique({
    where: { id: apiaryId },
    include: { hives: true },
  });

  if (!apiary) throw new Error('Apiary not found');

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const hiveIds = apiary.hives.map(h => h.id);

  const inspectionCount = await prisma.inspection.count({
    where: { hiveId: { in: hiveIds }, inspectionDate: { gte: yearStart, lte: yearEnd } },
  });

  const treatments = await prisma.treatment.findMany({
    where: { hiveId: { in: hiveIds }, treatmentDate: { gte: yearStart, lte: yearEnd } },
    include: { hive: { select: { hiveNumber: true } } },
    orderBy: { treatmentDate: 'asc' },
  });

  const production = await prisma.production.aggregate({
    where: {
      OR: [{ hiveId: { in: hiveIds } }, { apiaryId }],
      harvestDate: { gte: yearStart, lte: yearEnd },
    },
    _sum: { amountKg: true },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text(`Bigardrapport — ${apiary.name}`, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(`${year}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(12).font('Helvetica-Bold').text('Oversikt');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Lokasjon: ${apiary.locationName || 'Ikke angitt'}`);
    doc.text(`Antall kuber: ${apiary.hives.length}`);
    doc.text(`Aktive kuber: ${apiary.hives.filter(h => h.status === 'active').length}`);
    doc.text(`Inspeksjoner: ${inspectionCount}`);
    doc.text(`Behandlinger: ${treatments.length}`);
    doc.text(`Total produksjon: ${production._sum.amountKg || 0} kg`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Kuber');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');

    for (const hive of apiary.hives) {
      doc.text(`${hive.hiveNumber} — ${hive.status} | Styrke: ${hive.strength || '-'} | Kasser: ${hive.boxCount}`);
    }

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').text('Behandlinger');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');

    for (const t of treatments) {
      doc.text(`${formatDate(t.treatmentDate)} — Kube ${t.hive.hiveNumber}: ${t.productName} (${t.target || '-'})`);
    }

    doc.end();
  });
}
