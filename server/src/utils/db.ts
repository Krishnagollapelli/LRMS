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
    dbPath = path.resolve(__dirname, '../../../prisma/lrms.db');
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

// Run SQLite performance optimizations on startup
const isPostgres = process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgresql://') || process.env.DATABASE_URL.startsWith('postgres://'));
if (!isPostgres) {
  Promise.all([
    prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;'),
    prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;'),
    prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY;'),
    prisma.$queryRawUnsafe('PRAGMA cache_size = -64000;'),
    prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;')
  ])
    .then(() => logger.info('SQLite performance tuning pragmas applied successfully.'))
    .catch(err => logger.error('Failed to apply SQLite performance pragmas:', err));

  // Automatically record local modifications to the SyncQueue
  prisma.$use(async (params, next) => {
    const result = await next(params);
    const mutatingActions = ['create', 'update', 'delete', 'createMany', 'updateMany', 'deleteMany', 'upsert'];
    const syncedModels = ['Patient', 'Report', 'Doctor', 'Billing', 'Setting'];

    if (mutatingActions.includes(params.action) && syncedModels.includes(params.model || '')) {
      try {
        await prisma.syncQueue.create({
          data: {
            action: params.action.toUpperCase(),
            model: params.model || 'Unknown',
            recordId: result?.id || params.args?.where?.id || 'batch',
            payload: JSON.stringify(result || params.args?.data || {})
          }
        });
      } catch (e) {
        logger.error('Failed to write sync queue entry:', e);
      }
    }
    return result;
  });
}
