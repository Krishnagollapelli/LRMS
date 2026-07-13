import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { logger } from './utils/logger.js';
import { prisma } from './utils/db.js';

// Import routers
import { authRouter } from './modules/auth/auth.controller.js';
import { mkeRouter } from './modules/knowledge-engine/knowledgeEngine.controller.js';
import { patientsRouter } from './modules/patients/patients.controller.js';
import { doctorsRouter } from './modules/doctors/doctors.controller.js';
import { reportsRouter } from './modules/reports/reports.controller.js';
import { settingsRouter } from './modules/settings/settings.controller.js';
import { licensingRouter } from './modules/licensing/licensing.controller.js';
import { billingRouter } from './modules/billing/billing.controller.js';
import { startSyncEngine } from './modules/sync/syncEngine.js';
import { superAdminRouter } from './modules/super-admin/superAdmin.controller.js';

// Ensure the hardcoded super admin account always exists
async function ensureSuperAdmin() {
  try {
    const existing = await prisma.user.findFirst({ where: { username: 'krishna' } });
    if (!existing) {
      const hashed = bcrypt.hashSync('krishna@2006', 10);
      await prisma.user.create({
        data: {
          username: 'krishna',
          password: hashed,
          name: 'Super Administrator',
          role: 'SUPER_ADMIN',
          isActive: true
        }
      });
      logger.info('Super Admin account "krishna" seeded successfully.');
    } else if (existing.role !== 'SUPER_ADMIN') {
      // Upgrade existing account to super admin
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'SUPER_ADMIN', isActive: true }
      });
      logger.info('Super Admin account "krishna" upgraded to SUPER_ADMIN role.');
    }
  } catch (err) {
    logger.error('Failed to seed Super Admin account:', err);
  }
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for local Desktop Electron client
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Support base64 image uploads

// Route Registry
app.use('/api/auth', authRouter);
app.use('/api/licensing', licensingRouter);
app.use('/api/mke', mkeRouter); // Centralized Medical Knowledge Engine
app.use('/api/billing', billingRouter);
app.use('/api/super-admin', superAdminRouter);

// Operational endpoints
app.use('/api/patients', patientsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'lrms-api', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error occurred' });
});

// Start Server (only if not running under Vercel Serverless)
if (!process.env.VERCEL) {
  const server = app.listen(PORT, async () => {
    logger.info(`Laboratory API Server running on port ${PORT}`);
    // Seed the hardcoded super admin account
    await ensureSuperAdmin();
    // Start cloud sync daemon if configured
    startSyncEngine(30000); // sync every 30 seconds
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received. Closing HTTP server and database connections.');
    server.close(() => {
      prisma.$disconnect().then(() => {
        logger.info('Database disconnected. Safe shutdown complete.');
        process.exit(0);
      });
    });
  });
}

export default app;
