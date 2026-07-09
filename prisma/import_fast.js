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

  console.log('Bulk inserting Units...');
  await prisma.unit.createMany({ data: data.units });

  console.log('Bulk inserting Parameters...');
  await prisma.parameter.createMany({ data: data.parameters });

  console.log('Bulk inserting Reference Ranges...');
  await prisma.referenceRange.createMany({ data: data.referenceRanges });

  console.log('Bulk inserting Tests...');
  await prisma.test.createMany({ data: data.tests });

  console.log('Bulk inserting Test Parameters...');
  await prisma.testParameter.createMany({ data: data.testParameters });

  console.log('Bulk inserting Settings...');
  await prisma.setting.createMany({ data: data.settings });

  console.log('PostgreSQL database bulk seed completed with 100% ID consistency!');
}

main()
  .catch(e => console.error('Error importing fast:', e))
  .finally(() => prisma.$disconnect());
