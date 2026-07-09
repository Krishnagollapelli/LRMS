import { PrismaClient } from '@prisma/client';
import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

let supabaseDb: PrismaClient | null = null;
let isSyncing = false;
let syncInterval: NodeJS.Timeout | null = null;

// Initialize connection to Supabase if configured
function getSupabaseClient(): PrismaClient | null {
  const remoteUrl = process.env.SUPABASE_DATABASE_URL;
  if (!remoteUrl) return null;

  if (!supabaseDb) {
    logger.info('Initializing connection to remote Supabase database for synchronization.');
    supabaseDb = new PrismaClient({
      datasources: {
        db: {
          url: remoteUrl,
        },
      },
    });
  }
  return supabaseDb;
}

/**
 * Process the local SyncQueue and upload changes to Supabase.
 */
async function uploadPendingChanges(remoteDb: PrismaClient): Promise<number> {
  const batchSize = 50;
  const queue = await prisma.syncQueue.findMany({
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  if (queue.length === 0) return 0;

  logger.info(`Sync Engine: Found ${queue.length} pending local changes to upload.`);
  let successCount = 0;

  for (const item of queue) {
    try {
      const data = JSON.parse(item.payload);
      
      // Clean up metadata relation fields if present to avoid Prisma nested write issues
      if (data.patient) delete data.patient;
      if (data.doctor) delete data.doctor;
      if (data.visit) delete data.visit;
      if (data.billing) delete data.billing;
      if (data.results) delete data.results;
      if (data.reportTests) delete data.reportTests;

      const modelName = item.model.toLowerCase();

      if (item.action === 'CREATE' || item.action === 'UPDATE' || item.action === 'UPSERT') {
        if (modelName === 'patient') {
          await remoteDb.patient.upsert({
            where: { id: item.recordId },
            create: data,
            update: data,
          });
        } else if (modelName === 'report') {
          await remoteDb.report.upsert({
            where: { id: item.recordId },
            create: data,
            update: data,
          });
        } else if (modelName === 'doctor') {
          await remoteDb.doctor.upsert({
            where: { id: item.recordId },
            create: data,
            update: data,
          });
        } else if (modelName === 'billing') {
          await remoteDb.billing.upsert({
            where: { id: item.recordId },
            create: data,
            update: data,
          });
        } else if (modelName === 'setting') {
          await remoteDb.setting.upsert({
            where: { key: item.recordId },
            create: data,
            update: data,
          });
        }
      } else if (item.action === 'DELETE') {
        if (modelName === 'patient') {
          await remoteDb.patient.delete({ where: { id: item.recordId } }).catch(() => {});
        } else if (modelName === 'report') {
          await remoteDb.report.delete({ where: { id: item.recordId } }).catch(() => {});
        } else if (modelName === 'doctor') {
          await remoteDb.doctor.delete({ where: { id: item.recordId } }).catch(() => {});
        } else if (modelName === 'billing') {
          await remoteDb.billing.delete({ where: { id: item.recordId } }).catch(() => {});
        } else if (modelName === 'setting') {
          await remoteDb.setting.delete({ where: { key: item.recordId } }).catch(() => {});
        }
      }

      // Delete the sync queue item locally on success
      await prisma.syncQueue.delete({ where: { id: item.id } });
      successCount++;
    } catch (error: any) {
      logger.error(`Sync Engine: Failed to upload item ${item.id} (${item.model}):`, error);
      // Stop batch processing on network failure to maintain ordered transactions
      break;
    }
  }

  return successCount;
}

/**
 * Downloads recently updated changes from Supabase and applies them locally.
 */
async function downloadRemoteChanges(remoteDb: PrismaClient): Promise<void> {
  try {
    // Read last sync timestamp
    const lastSyncSetting = await prisma.setting.findUnique({
      where: { key: 'lrms_last_sync_timestamp' },
    });
    
    const lastSyncTime = lastSyncSetting?.value ? new Date(lastSyncSetting.value) : new Date(0);
    const newSyncTime = new Date();

    // Pull updated patients from cloud
    const updatedPatients = await remoteDb.patient.findMany({
      where: { updatedAt: { gt: lastSyncTime } },
    });

    for (const patient of updatedPatients) {
      await prisma.$executeRawUnsafe(
        'INSERT OR REPLACE INTO Patient (id, name, age, ageUnit, gender, phone, remarks, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        patient.id, patient.name, patient.age, patient.ageUnit, patient.gender, patient.phone, patient.remarks, patient.createdAt.toISOString(), patient.updatedAt.toISOString(), patient.deletedAt?.toISOString() || null
      );
    }

    // Pull updated reports from cloud
    const updatedReports = await remoteDb.report.findMany({
      where: { updatedAt: { gt: lastSyncTime } },
    });

    for (const report of updatedReports) {
      await prisma.$executeRawUnsafe(
        'INSERT OR REPLACE INTO Report (id, visitId, patientId, doctorId, sampleId, registrationDate, status, remarks, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        report.id, report.visitId, report.patientId, report.doctorId, report.sampleId, report.registrationDate.toISOString(), report.status, report.remarks, report.createdAt.toISOString(), report.updatedAt.toISOString(), report.deletedAt?.toISOString() || null
      );
    }

    // Update last sync setting
    await prisma.setting.upsert({
      where: { key: 'lrms_last_sync_timestamp' },
      create: { key: 'lrms_last_sync_timestamp', value: newSyncTime.toISOString() },
      update: { value: newSyncTime.toISOString() },
    });

  } catch (error: any) {
    logger.error('Sync Engine: Failed to download remote changes:', error);
  }
}

/**
 * Perform a full sync cycle.
 */
export async function runSync(): Promise<void> {
  const remoteDb = getSupabaseClient();
  if (!remoteDb) return; // Sync not configured

  if (isSyncing) return;
  isSyncing = true;

  try {
    // 1. Check cloud server connection
    await remoteDb.$queryRaw`SELECT 1`;

    // 2. Upload queue
    let uploadedCount = 0;
    do {
      uploadedCount = await uploadPendingChanges(remoteDb);
    } while (uploadedCount > 0);

    // 3. Download updates
    await downloadRemoteChanges(remoteDb);

  } catch (error: any) {
    logger.warn('Sync Engine: Cloud database unreachable or offline. Postponing synchronization.');
  } finally {
    isSyncing = false;
  }
}

/**
 * Starts the background Synchronization daemon loop.
 */
export function startSyncEngine(intervalMs = 30000): void {
  if (syncInterval) clearInterval(syncInterval);

  logger.info(`Sync Engine: Background synchronization daemon started (interval: ${intervalMs / 1000}s).`);
  
  // Run immediately on launch
  runSync();

  syncInterval = setInterval(() => {
    runSync();
  }, intervalMs);
}

/**
 * Stops the background Synchronization daemon.
 */
export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.info('Sync Engine: Background synchronization daemon stopped.');
  }
}
