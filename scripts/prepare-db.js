import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load local .env variables
dotenv.config();

const schemaPath = path.resolve('prisma/schema.prisma');
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at: ${schemaPath}`);
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, 'utf8');

// Determine protocol based on DATABASE_URL
const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

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
