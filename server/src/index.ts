import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { prisma } from './utils/db.js';

// Import routers
import { authRouter } from './modules/auth/auth.controller.js';
import { mkeRouter } from './modules/knowledge-engine/knowledgeEngine.controller.js';
import { patientsRouter } from './modules/patients/patients.controller.js';
import { doctorsRouter } from './modules/doctors/doctors.controller.js';
import { reportsRouter } from './modules/reports/reports.controller.js';
import { settingsRouter } from './modules/settings/settings.controller.js';
import { licensingRouter, licenseGuard } from './modules/licensing/licensing.controller.js';
import { billingRouter } from './modules/billing/billing.controller.js';
import { startSyncEngine } from './modules/sync/syncEngine.js';

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
app.use('/api/billing', licenseGuard, billingRouter);

// Guard operational endpoints with licensing fingerprint checks
app.use('/api/patients', licenseGuard, patientsRouter);
app.use('/api/doctors', licenseGuard, doctorsRouter);
app.use('/api/reports', licenseGuard, reportsRouter);
app.use('/api/settings', licenseGuard, settingsRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'lrms-api', timestamp: new Date() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error occurred' });
});

// Start Server
const server = app.listen(PORT, () => {
  logger.info(`Laboratory API Server running on port ${PORT}`);
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
