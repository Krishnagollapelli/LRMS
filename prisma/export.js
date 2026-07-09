import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Exporting SQLite data...');
  const units = await prisma.unit.findMany();
  const parameters = await prisma.parameter.findMany();
  const referenceRanges = await prisma.referenceRange.findMany();
  const tests = await prisma.test.findMany();
  const testParameters = await prisma.testParameter.findMany();
  const settings = await prisma.setting.findMany();
  
  const data = {
    units,
    parameters,
    referenceRanges,
    tests,
    testParameters,
    settings
  };
  
  fs.writeFileSync('templates_backup.json', JSON.stringify(data, null, 2));
  console.log('Data successfully written to templates_backup.json!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
