import { PrismaClient } from '@prisma/client';
import { MAJORS_CATALOG } from '../../src/pages/majorsCatalog.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.major.createMany({
    skipDuplicates: true,
    data: MAJORS_CATALOG.map(({ id: _id, slug: _slug, ...m }) => ({
      name: m.name,
      facultyName: m.facultyName,
      creditHours: m.creditHours,
      duration: m.duration,
      majorType: m.majorType ?? '',
      minAdmission: m.minAdmission,
      notes: m.notes ?? '',
    })),
  });
  console.log(`Seeded majors: ${MAJORS_CATALOG.length}`);
}

main()
  .catch((err) => {
    console.error('Failed to seed majors:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
