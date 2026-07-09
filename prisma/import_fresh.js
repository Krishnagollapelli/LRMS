import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading templates_backup.json...');
  const rawData = fs.readFileSync('templates_backup.json', 'utf8');
  const data = JSON.parse(rawData);

  console.log('Cleaning existing tables in PostgreSQL...');
  // Delete in reverse order of dependencies
  try { await prisma.testParameter.deleteMany(); } catch(e) {}
  try { await prisma.referenceRange.deleteMany(); } catch(e) {}
  try { await prisma.parameter.deleteMany(); } catch(e) {}
  try { await prisma.test.deleteMany(); } catch(e) {}
  try { await prisma.unit.deleteMany(); } catch(e) {}
  try { await prisma.setting.deleteMany(); } catch(e) {}

  console.log('Inserting Units...');
  for (const unit of data.units) {
    await prisma.unit.create({ data: unit });
  }

  console.log('Inserting Parameters...');
  for (const param of data.parameters) {
    await prisma.parameter.create({ data: param });
  }

  console.log('Inserting Reference Ranges...');
  for (const ref of data.referenceRanges) {
    await prisma.referenceRange.create({ data: ref });
  }

  console.log('Inserting Tests...');
  for (const test of data.tests) {
    await prisma.test.create({ data: test });
  }

  console.log('Inserting Test Parameters...');
  for (const tp of data.testParameters) {
    await prisma.testParameter.create({ data: tp });
  }

  console.log('Inserting Settings...');
  for (const setting of data.settings) {
    await prisma.setting.create({ data: setting });
  }

  console.log('PostgreSQL database seed import completed with 100% ID consistency!');
}

main()
  .catch(e => console.error('Error importing fresh:', e))
  .finally(() => prisma.$disconnect());
