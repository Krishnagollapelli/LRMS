import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';

let dbPath = '';

// Check if PostgreSQL database is provided (for cloud/Render deployment)
if (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgresql://') || process.env.DATABASE_URL.startsWith('postgres://'))) {
  logger.info(`Using cloud PostgreSQL database configured via DATABASE_URL.`);
} else {
  // Fall back to local SQLite file path resolution
  if (process.env.NODE_ENV === 'production' || process.env.IS_ELECTRON === 'true') {
    const appDataPath = process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? path.join(process.env.HOME || '', 'Library/Application Support') 
        : path.join(process.env.HOME || '', '.config'));
        
    const lrmsDataFolder = path.join(appDataPath, 'lrms');
    if (!fs.existsSync(lrmsDataFolder)) {
      fs.mkdirSync(lrmsDataFolder, { recursive: true });
    }
    dbPath = path.join(lrmsDataFolder, 'lrms.db');
  } else {
    dbPath = path.resolve(process.cwd(), '../prisma/lrms.db');
  }

  // Format properly for SQLite file path url
  const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = dbUrl;
  logger.info(`Database path resolved to local SQLite database: ${dbUrl}`);
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
