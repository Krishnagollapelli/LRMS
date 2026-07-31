import fs from 'fs';
import path from 'path';

const schemaPath = path.resolve('prisma/schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at: ${schemaPath}`);
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, 'utf8');

// Determine protocol based on DATABASE_URL (check process env first, then fall back to local .env file)
let dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
    if (match) {
      dbUrl = match[1];
    }
  }
}

const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || !!process.env.VERCEL;

let targetProvider = 'sqlite';
if (isPostgres) {
  targetProvider = 'postgresql';
}

// Regex to capture the provider line inside the datasource block
const providerRegex = /(datasource db {[\s\S]*?provider\s*=\s*")([^"]+)("[^}]*})/g;

if (providerRegex.test(schema)) {
  schema = schema.replace(providerRegex, (match, prefix, currentProvider, suffix) => {
    if (currentProvider !== targetProvider) {
      console.log(`[Database Prepare] Switching Prisma provider from "${currentProvider}" to "${targetProvider}"`);
      return `${prefix}${targetProvider}${suffix}`;
    }
    return match;
  });
  
  fs.writeFileSync(schemaPath, schema, 'utf8');
} else {
  console.warn('[Database Prepare] Could not find datasource provider line in schema.prisma');
}
