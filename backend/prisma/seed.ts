import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user (password: TestPass123!)
  const passwordHash = await bcrypt.hash('TestPass123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'test@birokt.no' },
    update: {},
    create: {
      email: 'test@birokt.no',
      name: 'Test Birøkter',
      passwordHash,
      phone: '+47 123 45 678',
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create apiaries
  const apiary1 = await prisma.apiary.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Heimebigård',
      description: 'Hovedbigård ved hjemmet med god sollys og le for vind.',
      locationName: 'Sandsli, Bergen',
      locationLat: 60.2885,
      locationLng: 5.2852,
      type: 'permanent',
      userApiaries: {
        create: {
          userId: user.id,
          role: 'owner',
        },
      },
    },
  });

  const apiary2 = await prisma.apiary.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Lyngbigård',
      description: 'Sesongbigård for lynghonning på Arna.',
      locationName: 'Arna, Bergen',
      locationLat: 60.4234,
      locationLng: 5.4567,
      type: 'seasonal',
      userApiaries: {
        create: {
          userId: user.id,
          role: 'owner',
        },
      },
    },
  });

  console.log(`✅ Created apiaries: ${apiary1.name}, ${apiary2.name}`);

  // Create hives for apiary 1
  const hives = await Promise.all([
    prisma.hive.upsert({
      where: { id: '00000000-0000-0000-0001-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000001',
        apiaryId: apiary1.id,
        hiveNumber: 'K01',
        qrCode: 'QR-K01-2025',
        status: 'active',
        strength: 'strong',
        hiveType: 'langstroth',
        boxCount: 2,
        queenYear: 2024,
        queenMarked: true,
        queenColor: 'green',
        queenRace: 'Buckfast',
        currentBroodFrames: 6,
        currentHoneyFrames: 4,
        notes: 'Meget produktiv koloni. God temperament.',
      },
    }),
    prisma.hive.upsert({
      where: { id: '00000000-0000-0000-0001-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000002',
        apiaryId: apiary1.id,
        hiveNumber: 'K02',
        qrCode: 'QR-K02-2025',
        status: 'active',
        strength: 'medium',
        hiveType: 'langstroth',
        boxCount: 2,
        queenYear: 2023,
        queenMarked: true,
        queenColor: 'blue',
        queenRace: 'Buckfast',
        currentBroodFrames: 4,
        currentHoneyFrames: 3,
        notes: 'Stabil koloni.',
      },
    }),
    prisma.hive.upsert({
      where: { id: '00000000-0000-0000-0001-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000003',
        apiaryId: apiary1.id,
        hiveNumber: 'K03',
        qrCode: 'QR-K03-2025',
        status: 'active',
        strength: 'strong',
        hiveType: 'langstroth',
        boxCount: 3,
        queenYear: 2024,
        queenMarked: true,
        queenColor: 'green',
        queenRace: 'Carnica',
        currentBroodFrames: 7,
        currentHoneyFrames: 5,
        notes: 'Rolig koloni, god honningprodusent.',
      },
    }),
    prisma.hive.upsert({
      where: { id: '00000000-0000-0000-0001-000000000004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000004',
        apiaryId: apiary1.id,
        hiveNumber: 'K04',
        qrCode: 'QR-K04-2025',
        status: 'nuc',
        strength: 'weak',
        hiveType: 'langstroth',
        boxCount: 1,
        queenYear: 2025,
        queenMarked: false,
        queenRace: 'Buckfast',
        currentBroodFrames: 2,
        currentHoneyFrames: 1,
        notes: 'Ny avlegger fra K01.',
      },
    }),
  ]);

  // Create hives for apiary 2
  const hives2 = await Promise.all([
    prisma.hive.upsert({
      where: { id: '00000000-0000-0000-0002-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0002-000000000001',
        apiaryId: apiary2.id,
        hiveNumber: 'L01',
        qrCode: 'QR-L01-2025',
        status: 'active',
        strength: 'strong',
        hiveType: 'langstroth',
        boxCount: 2,
        queenYear: 2024,
        queenMarked: true,
        queenColor: 'green',
        queenRace: 'Buckfast',
        currentBroodFrames: 5,
        currentHoneyFrames: 4,
      },
    }),
    prisma.hive.upsert({
      where: { id: '00000000-0000-0000-0002-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0002-000000000002',
        apiaryId: apiary2.id,
        hiveNumber: 'L02',
        qrCode: 'QR-L02-2025',
        status: 'active',
        strength: 'medium',
        hiveType: 'langstroth',
        boxCount: 2,
        queenYear: 2023,
        queenMarked: true,
        queenColor: 'blue',
        queenRace: 'Buckfast',
        currentBroodFrames: 4,
        currentHoneyFrames: 3,
      },
    }),
  ]);

  console.log(`✅ Created ${hives.length + hives2.length} hives`);

  // Create inspections
  const now = new Date();
  const inspections = await Promise.all([
    // Recent inspection for K01
    prisma.inspection.create({
      data: {
        hiveId: hives[0].id,
        userId: user.id,
        inspectionDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        temperature: 18.5,
        windSpeed: 3.2,
        weatherCondition: 'partly_cloudy',
        strength: 'strong',
        temperament: 'calm',
        queenSeen: true,
        queenLaying: true,
        broodFrames: 6,
        honeyFrames: 4,
        pollenFrames: 1,
        emptyFrames: 1,
        healthStatus: 'healthy',
        varroaLevel: 'low',
        diseases: '[]',
        pests: '[]',
        notes: 'Meget sterk koloni. God aktivitet ved flyhullet. Dronningen sett på ramme 4.',
      },
    }),
    // Older inspection for K01
    prisma.inspection.create({
      data: {
        hiveId: hives[0].id,
        userId: user.id,
        inspectionDate: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000), // 9 days ago
        temperature: 16.0,
        windSpeed: 2.1,
        weatherCondition: 'sunny',
        strength: 'strong',
        temperament: 'calm',
        queenSeen: false,
        queenLaying: true,
        broodFrames: 5,
        honeyFrames: 3,
        pollenFrames: 1,
        emptyFrames: 2,
        healthStatus: 'healthy',
        varroaLevel: 'low',
        diseases: '[]',
        pests: '[]',
        notes: 'Fin utvikling. Lagt til ekstra kassett.',
      },
    }),
    // Inspection for K02
    prisma.inspection.create({
      data: {
        hiveId: hives[1].id,
        userId: user.id,
        inspectionDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        temperature: 17.0,
        windSpeed: 4.5,
        weatherCondition: 'cloudy',
        strength: 'medium',
        temperament: 'calm',
        queenSeen: true,
        queenLaying: true,
        broodFrames: 4,
        honeyFrames: 3,
        pollenFrames: 1,
        emptyFrames: 2,
        healthStatus: 'healthy',
        varroaLevel: 'low',
        diseases: '[]',
        pests: '[]',
        notes: 'Stabil koloni. Vurderer dronningbytte neste år.',
      },
    }),
    // Inspection for K03 with warning
    prisma.inspection.create({
      data: {
        hiveId: hives[2].id,
        userId: user.id,
        inspectionDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        temperature: 19.0,
        windSpeed: 2.0,
        weatherCondition: 'sunny',
        strength: 'strong',
        temperament: 'nervous',
        queenSeen: false,
        queenLaying: true,
        broodFrames: 7,
        honeyFrames: 5,
        pollenFrames: 2,
        emptyFrames: 0,
        healthStatus: 'warning',
        varroaLevel: 'medium',
        diseases: '[]',
        pests: '[]',
        notes: 'Økt varroatrykk. Planlegger behandling. Nervøs temperament, mulig dronningløs?',
      },
    }),
  ]);

  console.log(`✅ Created ${inspections.length} inspections`);

  // Create treatments
  const treatments = await Promise.all([
    prisma.treatment.create({
      data: {
        hiveId: hives[0].id,
        userId: user.id,
        treatmentDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        productName: 'Oxalsyre',
        productType: 'organic_acid',
        target: 'varroa',
        dosage: '3.5% løsning, drypp',
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        withholdingPeriodDays: 0,
        notes: 'Vinterbehandling utført.',
      },
    }),
    prisma.treatment.create({
      data: {
        hiveId: hives[2].id,
        userId: user.id,
        treatmentDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        productName: 'Apivar',
        productType: 'chemical',
        target: 'varroa',
        dosage: '2 strips per yngelrom',
        startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        withholdingPeriodDays: 42,
        withholdingEndDate: new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000), // 37 days from now
        notes: 'Behandling pga. økt varroatrykk.',
      },
    }),
  ]);

  console.log(`✅ Created ${treatments.length} treatments`);

  // Create feedings
  const feedings = await Promise.all([
    prisma.feeding.create({
      data: {
        hiveId: hives[3].id, // K04 - nuc
        userId: user.id,
        feedingDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        feedType: 'sugar_syrup',
        amountKg: 2.0,
        sugarConcentration: 50.0,
        reason: 'spring_buildup',
        notes: '1:1 sirup for å stimulere oppbygging.',
      },
    }),
    prisma.feeding.create({
      data: {
        hiveId: hives[3].id,
        userId: user.id,
        feedingDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        feedType: 'sugar_syrup',
        amountKg: 2.0,
        sugarConcentration: 50.0,
        reason: 'spring_buildup',
        notes: 'Første fôring etter avlegger.',
      },
    }),
  ]);

  console.log(`✅ Created ${feedings.length} feedings`);

  // Create production records (from last year)
  const lastYear = now.getFullYear() - 1;
  const productions = await Promise.all([
    prisma.production.create({
      data: {
        hiveId: hives[0].id,
        apiaryId: apiary1.id,
        userId: user.id,
        harvestDate: new Date(lastYear, 7, 15), // August 15
        productType: 'honey',
        honeyType: 'sommerhonning',
        amountKg: 12.5,
        qualityGrade: 'premium',
        moistureContent: 17.2,
        pricePerKg: 180,
        totalRevenue: 2250,
        notes: 'Utmerket kvalitet.',
      },
    }),
    prisma.production.create({
      data: {
        hiveId: hives[2].id,
        apiaryId: apiary1.id,
        userId: user.id,
        harvestDate: new Date(lastYear, 7, 15),
        productType: 'honey',
        honeyType: 'sommerhonning',
        amountKg: 15.0,
        qualityGrade: 'premium',
        moistureContent: 16.8,
        pricePerKg: 180,
        totalRevenue: 2700,
        notes: 'Beste produsent i bigården.',
      },
    }),
    prisma.production.create({
      data: {
        apiaryId: apiary2.id,
        userId: user.id,
        harvestDate: new Date(lastYear, 8, 10), // September 10
        productType: 'honey',
        honeyType: 'lynghonning',
        amountKg: 8.5,
        qualityGrade: 'premium',
        moistureContent: 18.5,
        pricePerKg: 300,
        totalRevenue: 2550,
        notes: 'God lyngsesong.',
      },
    }),
  ]);

  console.log(`✅ Created ${productions.length} production records`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Test user credentials:');
  console.log('   Email: test@birokt.no');
  console.log('   Password: TestPass123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
