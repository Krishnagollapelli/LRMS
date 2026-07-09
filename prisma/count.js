import fs from 'fs';
const data = JSON.parse(fs.readFileSync('templates_backup.json', 'utf8'));
console.log('units:', data.units.length);
console.log('parameters:', data.parameters.length);
console.log('referenceRanges:', data.referenceRanges.length);
console.log('tests:', data.tests.length);
console.log('testParameters:', data.testParameters.length);
console.log('settings:', data.settings.length);
