import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading templates_backup.json...');
  const rawData = fs.readFileSync('templates_backup.json', 'utf8');
  const data = JSON.parse(rawData);

  console.log('Importing to PostgreSQL...');

  // 1. Units
  console.log(`Seeding ${data.units.length} units...`);
  for (const unit of data.units) {
    try {
      const existing = await prisma.unit.findFirst({
        where: { OR: [{ id: unit.id }, { name: unit.name }] }
      });
      if (existing) {
        await prisma.unit.update({
          where: { id: existing.id },
          data: {
            description: unit.description,
            isActive: unit.isActive
          }
        });
      } else {
        await prisma.unit.create({ data: unit });
      }
    } catch (e) {
      console.warn(`Skipping unit ${unit.name}: ${e.message}`);
    }
  }

  // 2. Parameters
  console.log(`Seeding ${data.parameters.length} parameters...`);
  for (const param of data.parameters) {
    try {
      const existing = await prisma.parameter.findFirst({
        where: { OR: [{ id: param.id }, { name: param.name }] }
      });
      if (existing) {
        await prisma.parameter.update({
          where: { id: existing.id },
          data: {
            description: param.description,
            unitId: param.unitId,
            isActive: param.isActive
          }
        });
      } else {
        await prisma.parameter.create({ data: param });
      }
    } catch (e) {
      console.warn(`Skipping parameter ${param.name}: ${e.message}`);
    }
  }

  // 3. Reference Ranges
  console.log(`Seeding ${data.referenceRanges.length} reference ranges...`);
  for (const ref of data.referenceRanges) {
    try {
      await prisma.referenceRange.upsert({
        where: { id: ref.id },
        update: ref,
        create: ref
      });
    } catch (e) {
      console.warn(`Skipping reference range ${ref.id}: ${e.message}`);
    }
  }

  // 4. Tests
  console.log(`Seeding ${data.tests.length} tests...`);
  for (const test of data.tests) {
    try {
      const existing = await prisma.test.findFirst({
        where: { OR: [{ id: test.id }, { name: test.name }, { code: test.code }] }
      });
      if (existing) {
        await prisma.test.update({
          where: { id: existing.id },
          data: {
            description: test.description,
            category: test.category,
            price: test.price,
            isActive: test.isActive
          }
        });
      } else {
        await prisma.test.create({ data: test });
      }
    } catch (e) {
      console.warn(`Skipping test ${test.name}: ${e.message}`);
    }
  }

  // 5. Test Parameters
  console.log(`Seeding ${data.testParameters.length} test-parameters...`);
  for (const tp of data.testParameters) {
    try {
      await prisma.testParameter.upsert({
        where: { id: tp.id },
        update: tp,
        create: tp
      });
    } catch (e) {
      console.warn(`Skipping test-parameter link ${tp.id}: ${e.message}`);
    }
  }

  // 6. Settings
  console.log(`Seeding ${data.settings.length} settings...`);
  for (const setting of data.settings) {
    try {
      await prisma.setting.upsert({
        where: { key: setting.key },
        update: setting,
        create: setting
      });
    } catch (e) {
      console.warn(`Skipping setting ${setting.key}: ${e.message}`);
    }
  }

  console.log('PostgreSQL database import finished successfully!');
}

main()
  .catch(e => console.error('Error importing:', e))
  .finally(() => prisma.$disconnect());
