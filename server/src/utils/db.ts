import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';

let dbPath = '';

// If running inside Electron or production, place database in AppData folder
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
  // Local development path
  dbPath = path.resolve(process.cwd(), '../prisma/lrms.db');
}

// Format properly for SQLite file path url
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = dbUrl;

logger.info(`Database path resolved to: ${dbUrl}`);

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});
