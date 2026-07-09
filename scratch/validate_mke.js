import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Medical Knowledge Engine (MKE) Validation ===");
  
  const unitCount = await prisma.unit.count();
  const paramCount = await prisma.parameter.count();
  const testCount = await prisma.test.count();
  const rangeCount = await prisma.referenceRange.count();
  const analyzerCount = await prisma.analyzerProfile.count();
  
  console.log(`Current DB Counts:`);
  console.log(`- Units: ${unitCount}`);
  console.log(`- Parameters: ${paramCount}`);
  console.log(`- Test Templates: ${testCount}`);
  console.log(`- Reference Ranges: ${rangeCount}`);
  console.log(`- Analyzer Profiles: ${analyzerCount}`);
  
  // Check duplicates
  const units = await prisma.unit.findMany();
  const params = await prisma.parameter.findMany();
  const tests = await prisma.test.findMany();
  
  const unitNames = units.map(u => u.name);
  const paramCodes = params.map(p => p.shortCode);
  const testCodes = tests.map(t => t.shortCode);
  
  const duplicateUnits = unitNames.filter((item, index) => unitNames.indexOf(item) !== index);
  const duplicateParams = paramCodes.filter((item, index) => paramCodes.indexOf(item) !== index);
  const duplicateTests = testCodes.filter((item, index) => testCodes.indexOf(item) !== index);
  
  console.log("\n=== Duplicate Checks ===");
  console.log(`Duplicate Units: ${duplicateUnits.length === 0 ? "PASSED (None)" : "FAILED: " + JSON.stringify(duplicateUnits)}`);
  console.log(`Duplicate Parameters: ${duplicateParams.length === 0 ? "PASSED (None)" : "FAILED: " + JSON.stringify(duplicateParams)}`);
  console.log(`Duplicate Test Templates: ${duplicateTests.length === 0 ? "PASSED (None)" : "FAILED: " + JSON.stringify(duplicateTests)}`);
  
  console.log("\n=== Target Quantities Checks ===");
  console.log(`Units >= 100: ${unitCount >= 100 ? "PASSED" : "FAILED"}`);
  console.log(`Parameters >= 3000: ${paramCount >= 3000 ? "PASSED" : "FAILED"}`);
  console.log(`Test Templates >= 300: ${testCount >= 300 ? "PASSED" : "FAILED"}`);
  
  console.log("\n=== Analyzer Configurations Checks ===");
  const analyzers = await prisma.analyzerProfile.findMany();
  console.log(`Total Configured Analyzers: ${analyzers.length}`);
  for (const ana of analyzers) {
    const config = JSON.parse(ana.config || "[]");
    console.log(`- ${ana.name} (${ana.model}) connection: ${ana.connectionType}, Mapped Channels: ${config.length}`);
  }
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
